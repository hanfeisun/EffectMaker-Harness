"""Effect Maker helpers layered on browser-harness 0.1.13 (English UI).

Import inside browser-harness after selecting the authorized project tab.
The harness owns connection/session management; this module only adds site logic.
"""
import math
import os
import time
from contextlib import contextmanager
from urllib.parse import urlparse

ORIGIN = 'https://effects.youtube.com'
# Toolbar panel -> optional sub-button -> creation button. Keep in sync with `recipes` in sdk.mjs.
RECIPES = {
    'text': ('Text', None, 'Add text'),
    'filter': ('Visual effects', 'Color filter', 'Add filter'),
    'lut': ('Visual effects', 'Color filter', 'Use LUT'),
    'particles': ('Visual effects', 'Particles', 'Add particles'),
    'image': ('Image and video', 'Images', 'Add image'),
    'imageSequence': ('Image and video', 'Images', 'Add image sequence'),
    'facePaint': ('Face effects', 'Face paint', 'Add paint'),
    'faceMaterial': ('Face effects', 'Face paint', 'Add 3D material'),
    'faceAccessory': ('Face effects', 'Face accessory', 'Add image'),
    'faceModel': ('Face effects', 'Face accessory', 'Add 3D model'),
    'stretch': ('Face effects', 'Stretch', 'Add stretch'),
    'body': ('Camera and segmentation', 'Body segmentation', 'Add body'),
    'bodyBackground': ('Camera and segmentation', 'Body segmentation', 'Add body and background'),
    'camera': ('Camera and segmentation', 'Camera feed', 'Add camera feed'),
    'model': ('3D', '3D model', 'Add 3D model'),
    'light': ('3D', 'Light', 'Add light'),
    'snapshot': ('Image and video', 'Camera snapshot', 'Add with visual script'),
    'drawing': ('Image and video', 'Draw', 'Add with visual script'),
    'aiImage': ('Image and video', 'AI image', 'Add with visual script'),
    'aiVideo': ('Image and video', 'AI video', 'Add with visual script'),
}
PANELS = {'Objects and assets', 'Visual effects', 'Image and video', 'Face effects',
          'Camera and segmentation', 'Text', '3D', 'Visual scripting'}
PANEL_HEADINGS = {'Visual scripting': 'Visual script'}
# The asset dialog is a native <dialog>; its file input is not inside a [role=dialog] element.
ASSET_DIALOG = 'dialog[open]'
_TEXT_ROLES = {'StaticText', 'InlineTextBox', 'generic', 'none', 'LineBreak', 'paragraph'}


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

    @contextmanager
    def focused(self):
        """Emulate focus/visibility for a background tab without foregrounding Chrome.

        Effect Maker ignores some clicks (e.g. New project) while its tab is hidden.
        """
        self.h.cdp('Emulation.setFocusEmulationEnabled', enabled=True)
        try:
            yield self
        finally:
            self.h.cdp('Emulation.setFocusEmulationEnabled', enabled=False)

    def create_project(self, name):
        """Create a project from Home in the current tab and rename it. Returns page_info()."""
        if not str(name).strip():
            raise ValueError('Project name required')
        with self.focused():
            return self._create_project(name)

    def _create_project(self, name):
        info = self.h.page_info()
        if urlparse(info['url']).path.startswith('/edit/') and not self.saved()['saved']:
            raise RuntimeError('Current project is not saved; wait or inspect before leaving it')
        if info['url'] != ORIGIN + '/home':
            self.h.goto_url(ORIGIN + '/home')
            self.h.wait_for_load()
        # Home hydrates after load; an early click is silently ignored. Never click twice (it creates two projects).
        self.wait_for('button', 'New project')
        self.h.wait_for_network_idle(timeout=self.timeout)
        self.click('button', 'New project')
        self._poll(lambda: urlparse(self.h.page_info()['url']).path.startswith('/edit/') and self.exists('textbox', 'Project title'),
                   'Editor did not open after New project; inspect before retrying')
        self.rename_project(name)
        return self.h.page_info()

    def rename_project(self, name):
        if not str(name).strip():
            raise ValueError('Project name required')
        actual = self.replace('textbox', 'Project title', name)
        if actual != name:
            raise RuntimeError(f'Project title reads {actual!r}; inspect state')
        return self.wait_saved()

    def tree(self):
        return self.h.cdp('Accessibility.getFullAXTree')['nodes']

    def _matches(self, role, name, nodes=None):
        nodes = self.tree() if nodes is None else nodes
        return [n for n in nodes if not n.get('ignored') and n.get('role', {}).get('value') == role and n.get('name', {}).get('value') == name]

    def exists(self, role, name, level=None):
        matches = self._matches(role, name)
        if level is not None:
            matches = [n for n in matches if any(p['name'] == 'level' and p.get('value', {}).get('value') == level for p in n.get('properties', []))]
        return bool(matches)

    def _poll(self, check, message, timeout=None):
        end = time.monotonic() + (self.timeout if timeout is None else timeout)
        while True:
            result = check()
            if result:
                return result
            if time.monotonic() >= end:
                raise TimeoutError(message)
            time.sleep(.2)

    def wait_for(self, role, name, timeout=None):
        """Wait until a matching node appears, then return it via find() (which rejects ambiguity). Read-only."""
        self._poll(lambda: len(self._matches(role, name)) >= 1, f'{role} {name} did not appear', timeout)
        return self.find(role, name)

    def outline(self, roles=None, contains=None, within=None, limit=200):
        """Return named, non-text AX nodes as (role, name, value) tuples for inspection."""
        nodes = self.tree()
        allowed = None
        if within:
            roots = self._matches(within[0], within[1], nodes)
            if len(roots) != 1:
                raise RuntimeError('Scope must match exactly one node')
            allowed = self._descendants(nodes, roots[0])
        rows = []
        for n in nodes:
            role = n.get('role', {}).get('value'); name = n.get('name', {}).get('value') or ''
            if n.get('ignored') or (allowed is not None and n['nodeId'] not in allowed):
                continue
            if (roles and role not in roles) or (not roles and (role in _TEXT_ROLES or not name)):
                continue
            if contains and contains.lower() not in name.lower():
                continue
            rows.append((role, name, n.get('value', {}).get('value')))
            if len(rows) >= limit:
                break
        return rows

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

    def click(self, role, name, button='left', **scope):
        node = self.find(role, name, **scope)
        backend = node['backendDOMNodeId']
        self.h.cdp('DOM.scrollIntoViewIfNeeded', backendNodeId=backend)
        quad = self.h.cdp('DOM.getBoxModel', backendNodeId=backend)['model']['content']
        self.h.click_at_xy(sum(quad[::2])/4, sum(quad[1::2])/4, button=button)
        return self.tree()

    def attributes(self, node):
        self.h.cdp('DOM.getDocument')
        ids = self.h.cdp('DOM.pushNodesByBackendIdsToFrontend', backendNodeIds=[node['backendDOMNodeId']])['nodeIds']
        values = self.h.cdp('DOM.getAttributes', nodeId=ids[0])['attributes']
        return dict(zip(values[::2], values[1::2]))

    def _type_over(self, value):
        """Select all text in the focused field and type value."""
        ua = self.h.cdp('Browser.getVersion').get('userAgent', '')
        modifier = 4 if 'Macintosh' in ua or 'Mac OS X' in ua else 2
        # Explicit selectAll also works in headless Chromium on macOS.
        self.h.cdp('Input.dispatchKeyEvent', type='keyDown', key='a', code='KeyA', windowsVirtualKeyCode=65, modifiers=modifier, commands=['selectAll'])
        self.h.cdp('Input.dispatchKeyEvent', type='keyUp', key='a', code='KeyA', windowsVirtualKeyCode=65, modifiers=modifier)
        self.h.type_text(str(value))

    def replace(self, role, name, value, **scope):
        self.click(role, name, **scope)
        self._type_over(value)
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

    def _panel_open(self, name):
        if name == 'Objects and assets':
            return self.exists('tab', 'Objects')
        return self.exists('heading', PANEL_HEADINGS.get(name, name), level=2)

    def open_panel(self, name):
        """Open a toolbar panel at its root. Toolbar buttons toggle, and one click can close a subpanel instead."""
        if name not in PANELS:
            raise ValueError('Unknown panel: ' + name)
        for _ in range(2):
            if self._panel_open(name):
                return self.tree()
            self.click('button', name, index=0)
            try:
                self._poll(lambda: self._panel_open(name), '', timeout=2)
            except TimeoutError:
                pass
        if not self._panel_open(name):
            raise RuntimeError(f'Panel {name} did not open; inspect the toolbar state')
        return self.tree()

    def choose(self, group, label, option, upload=None):
        """Pick an option from a combobox scoped to a property group, e.g. choose('LUT', 'LUT', 'None').

        'Add ...' options such as 'Add LUT...' open the OS file chooser directly (no in-page dialog).
        Pass upload=path for those: the chooser is intercepted, so no native window appears.
        Returns the committed combobox value.
        """
        scope = ('group', group)
        read = lambda: self.find('combobox', label, within=scope).get('value', {}).get('value')
        self.click('combobox', label, within=scope)
        self.wait_for('option', option)
        if upload is None:
            self.click('option', option)
            self._poll(lambda: read() == option, f'{label} did not change to {option}; inspect state')
        else:
            path = os.path.abspath(upload)
            if not os.path.isfile(path):
                raise FileNotFoundError(path)
            self._upload_through_chooser(lambda: self.click('option', option), path)
            expected = os.path.splitext(os.path.basename(path))[0]
            self._poll(lambda: read() == expected, f'{label} did not change to {expected}; inspect state')
        self.wait_saved()
        return read()

    def _upload_through_chooser(self, trigger, path):
        """Run trigger(), capture the native file chooser it opens, and answer it with path."""
        self.h.cdp('Page.enable')
        self.h.drain_events()
        self.h.cdp('Page.setInterceptFileChooserDialog', enabled=True)
        try:
            trigger()
            event = self._poll(lambda: next((e for e in self.h.drain_events() if e.get('method') == 'Page.fileChooserOpened'), None),
                               'No file chooser opened; inspect state before retrying', timeout=5)
            self.h.cdp('DOM.setFileInputFiles', files=[path], backendNodeId=event['params']['backendNodeId'])
        finally:
            self.h.cdp('Page.setInterceptFileChooserDialog', enabled=False)

    def show_objects(self):
        self.open_panel('Objects and assets')
        return self.click('tab', 'Objects')

    def show_assets(self):
        self.open_panel('Objects and assets')
        return self.click('tab', 'Assets')

    def objects(self):
        self.show_objects()
        return [name for _, name, _ in self.outline(roles=['treeitem'])]

    def assets(self):
        self.show_assets()
        return [name for _, name, _ in self.outline(roles=['treeitem'])]

    def select_object(self, accessible_name):
        self.show_objects()
        return self.click('treeitem', accessible_name)

    def _object_names(self):
        """Object tree names; assumes the Objects tab is showing."""
        return [name for _, name, _ in self.outline(roles=['treeitem'])]

    def object_menu(self, accessible_name, action):
        """Choose Duplicate, Rename or Delete from an object's context menu.

        The menu is a manual popover: Escape does not close it, choosing an item or clicking a row does.
        """
        if action not in ('Duplicate', 'Rename', 'Delete'):
            raise ValueError('Unsupported object action: ' + action)
        self.select_object(accessible_name)
        self.click('treeitem', accessible_name, button='right')
        self.wait_for('menuitem', action)
        return self.click('menuitem', action)

    def duplicate_object(self, accessible_name):
        """Duplicate an object and return the new accessible name (observed: '<name> 2')."""
        before = set(self.objects())
        self.object_menu(accessible_name, 'Duplicate')
        added = self._poll(lambda: [n for n in self._object_names() if n not in before], 'Duplicate not observed; inspect before retrying')
        if len(added) != 1:
            raise RuntimeError(f'Expected one new object, saw {added}')
        self.wait_saved()
        return added[0]

    def rename_object(self, accessible_name, name):
        """Rename an object; returns its new accessible name ('<type> object: <name>')."""
        if not str(name).strip():
            raise ValueError('Object name required')
        kind = accessible_name.split(': ', 1)[0]
        self.object_menu(accessible_name, 'Rename')
        self.wait_for('textbox', 'Scene object name')
        self._type_over(name)
        self.h.press_key('Enter')
        # Enter committed in live checks; blur explicitly if the field is still open.
        if self.exists('textbox', 'Scene object name'):
            self.click('textbox', 'Project title')
        self._poll(lambda: not self.exists('textbox', 'Scene object name'), 'Rename field did not close; inspect state')
        self.wait_saved()
        renamed = f'{kind}: {name}'
        if renamed not in self.objects():
            raise RuntimeError(f'{renamed} not found after rename; inspect state')
        return renamed

    def delete_object(self, accessible_name):
        """Delete one object. There is no confirmation dialog; Undo restores it."""
        if self.objects().count(accessible_name) != 1:
            raise RuntimeError(f'{accessible_name} must match exactly one object')
        self.object_menu(accessible_name, 'Delete')
        self._poll(lambda: accessible_name not in self._object_names(), 'Object still present after Delete; inspect state')
        return self.wait_saved()

    def set_object_visible(self, accessible_name, visible):
        """Show or hide an object in the editor scene view only; the effect and the Preview panel are unaffected.

        The row button is named for the current state ('Visibility On' = shown).
        """
        self.select_object(accessible_name)
        row = ('treeitem', accessible_name)
        labels = [label for label in ('Visibility On', 'Visibility Off') if self.exists_within(row, 'button', label)]
        if len(labels) != 1:
            raise RuntimeError(f'Visibility state of {accessible_name} not found; inspect the row')
        current = labels[0]
        target = 'Visibility On' if visible else 'Visibility Off'
        if current != target:
            self.click('button', current, within=row)
            self._poll(lambda: self.exists_within(row, 'button', target), f'{accessible_name} did not switch to {target}')
        self.wait_saved()
        return bool(visible)

    def exists_within(self, scope, role, name):
        return any(r == role and n == name for r, n, _ in self.outline(roles=[role], within=scope))

    def begin_add(self, kind):
        """Follow a RECIPES route up to the creation button. Asset kinds then open the asset dialog."""
        route = RECIPES.get(kind)
        if route is None:
            raise ValueError('Unknown object kind: ' + kind)
        if kind == 'lut' and any(name.startswith('Color filter object: ') for name in self.objects()):
            # The editor does not block it, but an effect may use only one LUT.
            raise RuntimeError("A color filter already exists; swap its LUT with choose('LUT', 'LUT', 'Add LUT...', upload=path)")
        panel, sub, create = route
        self.open_panel(panel)
        if sub:
            self.click('button', sub, index=0)
        self.wait_for('button', create)
        return self.click('button', create)

    def asset_dialog_text(self):
        return self.h.js(f'document.querySelector({ASSET_DIALOG!r})?.innerText ?? null')

    def upload_asset(self, path):
        """Upload a local file into the open asset dialog, e.g. after begin_add('lut') or begin_add('model').

        A successful upload closes the dialog and creates the object; Done is never clicked.
        On timeout, inspect state rather than uploading again.
        """
        path = os.path.abspath(path)
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
        if self.asset_dialog_text() is None:
            raise RuntimeError('No asset dialog is open; call begin_add() first')
        self.h.upload_file(f'{ASSET_DIALOG} input[type=file]', path)
        try:
            self._poll(lambda: self.asset_dialog_text() is None, 'Asset dialog still open after upload; inspect it before retrying')
        except TimeoutError as error:
            raise TimeoutError(f'{error}. Dialog text: {self.asset_dialog_text()!r}') from None
        return {**self.wait_saved(), 'objects': self.objects()}

    def add_text(self, text):
        self.begin_add('text')
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
