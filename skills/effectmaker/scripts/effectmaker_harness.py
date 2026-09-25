"""Effect Maker helpers layered on browser-harness 0.1.13 (English UI).

Import inside browser-harness after selecting the authorized project tab.
The harness owns connection/session management; this module only adds site logic.
"""
import math
import time
from urllib.parse import urlparse


class EffectMakerHarness:
    def __init__(self, helpers=None, timeout=15):
        if helpers is None:
            from browser_harness import helpers
        self.h = helpers
        self.timeout = timeout

    def attach_project(self, url):
        parsed = urlparse(url)
        if parsed.scheme != 'https' or parsed.netloc != 'effects.youtube.com' or not parsed.path.startswith('/edit/'):
            raise ValueError('Expected an Effect Maker project URL')
        matches = [t for t in self.h.list_tabs() if t.get('url') == url]
        if len(matches) != 1:
            raise RuntimeError('Open exactly one authorized project tab in the connected browser first')
        self.h.switch_tab(matches[0]['targetId'])
        self.find('textbox', 'Project title')
        return self.h.page_info()

    def tree(self):
        return self.h.cdp('Accessibility.getFullAXTree')['nodes']

    @staticmethod
    def _descendants(nodes, root):
        by_id = {n['nodeId']: n for n in nodes}
        found, pending = set(), [root['nodeId']]
        while pending:
            key = pending.pop()
            if key not in found:
                found.add(key)
                pending.extend(by_id.get(key, {}).get('childIds', []))
        return found

    def find(self, role, name, within=None, index=None):
        nodes = self.tree()
        allowed = None
        if within:
            roots = [n for n in nodes if not n.get('ignored') and n.get('role', {}).get('value') == within[0] and n.get('name', {}).get('value') == within[1]]
            if len(roots) != 1:
                raise RuntimeError('Scope must match exactly one node')
            allowed = self._descendants(nodes, roots[0])
        matches = [n for n in nodes if not n.get('ignored') and n.get('role', {}).get('value') == role and n.get('name', {}).get('value') == name and (allowed is None or n['nodeId'] in allowed)]
        if index is None and len(matches) != 1:
            raise RuntimeError(f'{role} {name}: {len(matches)} matches; inspect and scope the target')
        if index is not None and (index < 0 or index >= len(matches)):
            raise RuntimeError('Index is outside observed matches')
        node = matches[0 if index is None else index]
        if any(p['name'] == 'disabled' and p.get('value', {}).get('value') is True for p in node.get('properties', [])):
            raise RuntimeError(f'Disabled control: {name}')
        return node

    def click(self, role, name, **scope):
        node = self.find(role, name, **scope)
        backend = node['backendDOMNodeId']
        self.h.cdp('DOM.scrollIntoViewIfNeeded', backendNodeId=backend)
        quad = self.h.cdp('DOM.getBoxModel', backendNodeId=backend)['model']['content']
        self.h.click_at_xy(sum(quad[::2])/4, sum(quad[1::2])/4)
        return self.tree()

    def attributes(self, node):
        self.h.cdp('DOM.getDocument')
        ids = self.h.cdp('DOM.pushNodesByBackendIdsToFrontend', backendNodeIds=[node['backendDOMNodeId']])['nodeIds']
        values = self.h.cdp('DOM.getAttributes', nodeId=ids[0])['attributes']
        return dict(zip(values[::2], values[1::2]))

    def replace(self, role, name, value, **scope):
        self.click(role, name, **scope)
        ua = self.h.cdp('Browser.getVersion').get('userAgent', '')
        modifier = 4 if 'Macintosh' in ua or 'Mac OS X' in ua else 2
        # Explicit selectAll also works in headless Chromium on macOS.
        self.h.cdp('Input.dispatchKeyEvent', type='keyDown', key='a', code='KeyA', windowsVirtualKeyCode=65, modifiers=modifier, commands=['selectAll'])
        self.h.cdp('Input.dispatchKeyEvent', type='keyUp', key='a', code='KeyA', windowsVirtualKeyCode=65, modifiers=modifier)
        self.h.type_text(str(value))
        if role != 'textbox':
            self.h.press_key('Enter')
        self.h.press_key('Tab')
        return self.find(role, name, **scope).get('value', {}).get('value')

    def saved(self):
        label = self.attributes(self.find('button', 'Save status indicator')).get('data-title')
        return {'saved': label == 'Saved', 'label': label}

    def wait_saved(self):
        end = time.monotonic() + self.timeout
        while True:
            result = self.saved()
            if result['saved']:
                return result
            if time.monotonic() >= end:
                raise TimeoutError('Save not confirmed; inspect state before repeating a mutation')
            time.sleep(.1)

    def set_number(self, group, label, value, index=None):
        value = float(value)
        if not math.isfinite(value):
            raise ValueError('Finite numeric value required')
        scope = {'within': ('group', group), 'index': index}
        attrs = self.attributes(self.find('spinbutton', label, **scope))
        if ('aria-valuemin' in attrs and value < float(attrs['aria-valuemin'])) or ('aria-valuemax' in attrs and value > float(attrs['aria-valuemax'])):
            raise ValueError('Value outside observed control bounds')
        actual = float(self.replace('spinbutton', label, format(value, '.15g'), **scope))
        committed = self.attributes(self.find('spinbutton', label, **scope)).get('aria-valuenow')
        if actual != value or committed is not None and float(committed) != value:
            raise RuntimeError('Number did not commit; inspect state')
        self.wait_saved()
        return {'value': actual, 'committed': None if committed is None else float(committed)}

    def show_objects(self):
        if not any(n.get('role', {}).get('value') == 'tab' and n.get('name', {}).get('value') == 'Objects' for n in self.tree()):
            self.click('button', 'Objects and assets')
        return self.click('tab', 'Objects')

    def select_object(self, accessible_name):
        self.show_objects()
        return self.click('treeitem', accessible_name)

    def add_text(self, text):
        for _ in range(2):
            if any(n.get('role', {}).get('value') == 'button' and n.get('name', {}).get('value') == 'Add text' for n in self.tree()):
                break
            self.click('button', 'Text', index=0)
        self.click('button', 'Add text')
        self.replace('textbox', 'Text content', text, within=('group', 'Text'))
        return self.wait_saved()

    def undo(self):
        self.click('button', 'Undo')
        return self.wait_saved()

    def redo(self):
        self.click('button', 'Redo')
        return self.wait_saved()

    def graph_count(self):
        nodes = self.tree()
        root = self.find('region', 'Visual scripting viewport')
        ids = self._descendants(nodes, root)
        return sum(not n.get('ignored') and n['nodeId'] in ids for n in nodes)

    def smoke_node(self, category, name):
        for _ in range(2):
            if any(n.get('role', {}).get('value') == 'heading' and n.get('name', {}).get('value') == 'Visual script' for n in self.tree()):
                break
            self.click('button', 'Visual scripting')
        self.click('button', category)
        self.click('button', name)
        before = self.graph_count()
        self.click('button', 'Add node')
        if self.graph_count() <= before:
            raise RuntimeError('No node added; inspect before retrying')
        self.undo()
        if self.graph_count() != before:
            raise RuntimeError('Undo did not restore graph; stopped')
        return {'category': category, 'name': name, 'created': True, 'undoRestored': True, 'executionTested': False}
