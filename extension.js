/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Meta from 'gi://Meta';

export default class YaHideTopbarExtension extends Extension {
    _applyLayout() {
        const panelBox = Main.layoutManager.panelBox;

        if (Main.sessionMode.isLocked || Main.sessionMode.currentMode === 'unlock-dialog') {
            if (panelBox.get_parent() === Main.layoutManager.overviewGroup)
                Main.layoutManager.overviewGroup.remove_child(panelBox);

            if (panelBox.get_parent() !== Main.layoutManager.uiGroup)
                Main.layoutManager.uiGroup.add_child(panelBox);

            Main.layoutManager.uiGroup.set_child_above_sibling(
                panelBox,
                Main.layoutManager.screenShieldGroup
            );
        } else {
            // TKS: https://gitlab.gnome.org/jrahmatzadeh/just-perfection/-/blob/main/src/lib/API.js#L425
            if (panelBox.get_parent() === Main.layoutManager.uiGroup)
                Main.layoutManager.removeChrome(panelBox);

            if (panelBox.get_parent() !== Main.layoutManager.overviewGroup)
                Main.layoutManager.overviewGroup.insert_child_at_index(panelBox, 0);
        }

        panelBox.translation_y = 0;

        Main.layoutManager._updateHotCorners();

        const searchEntry = Main.overview.searchEntry;

        if (Main.sessionMode.isLocked || Main.sessionMode.currentMode === 'unlock-dialog') {
            searchEntry.set_style(`margin-top: 0;`);
        } else {
            const panelHeight = Main.panel.height;
            const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            // Apply margin-top on the St.Entry itself, not on its parent Bin.
            // Dash to Dock's ControlsManagerLayout.allocate vfunc injection re-allocates
            // the searchEntry *parent* (St.Bin) horizontally when the dock is on LEFT/RIGHT
            // with `dockFixed=true`, preserving the Bin's y1. If the margin-top lives on the
            // Bin, its get_preferred_height gets inflated, which feeds back into searchHeight
            // used by the upstream allocate for subsequent boxes (dash, thumbnails, search
            // controller), cascading mis-sizing when the dock reserves horizontal strut space.
            // Keeping the margin on the leaf Entry avoids inflating the Bin's preferred height
            // while still visually pushing the entry content below the panel.
            searchEntry.set_style(`margin-top: ${Math.round(panelHeight / scaleFactor)}px;`);
        }

        // hide and show can fix windows going under panel
        panelBox.hide();
        panelBox.show();
    }

    enable() {
        this._applyLayout();

        if (this._hidePanelWorkareasChangedSignal) {
            global.display.disconnect(this._hidePanelWorkareasChangedSignal);
            delete (this._hidePanelWorkareasChangedSignal);
        }
        this._hidePanelWorkareasChangedSignal = global.display.connect(
            'workareas-changed',
            () => this._scheduleApply()
        );

        if (!this._hidePanelHeightSignal) {
            this._hidePanelHeightSignal = Main.layoutManager.panelBox.connect(
                'notify::height',
                () => this._scheduleApply()
            );
        }

        if (!this._hidePanelSessionModeSignal) {
            this._hidePanelSessionModeSignal = Main.sessionMode.connect(
                'updated',
                () => this._applyLayout()
            );
        }
    }

    _scheduleApply() {
        if (this._applyLaterId)
            return;
        this._applyLaterId = Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._applyLaterId = 0;
            this._applyLayout();
            return false;
        });
    }

    disable() {
        // unlock-dialog is required so the panel won't flickers after unlocking shell
        // see: https://github.com/jiesou/gnome-shell-extensions-ya-hide-top-panel/commit/1a6adf5abb47e4633153f9f99dbf82e4338e0604
        const panelBox = Main.layoutManager.panelBox;

        if (this._applyLaterId) {
            Meta.later_remove(this._applyLaterId);
            this._applyLaterId = 0;
        }

        panelBox.translation_y = 0;

        if (panelBox.get_parent() === Main.layoutManager.overviewGroup)
            Main.layoutManager.overviewGroup.remove_child(panelBox);
        else if (panelBox.get_parent() === Main.layoutManager.uiGroup)
            Main.layoutManager.removeChrome(panelBox);

        if (panelBox.get_parent() !== Main.layoutManager.uiGroup) {
            Main.layoutManager.addChrome(panelBox, {
                affectsStruts: true,
                trackFullscreen: true,
            });
        }

        if (this._hidePanelWorkareasChangedSignal) {
            global.display.disconnect(this._hidePanelWorkareasChangedSignal);
            delete (this._hidePanelWorkareasChangedSignal);
        }

        if (this._hidePanelHeightSignal) {
            panelBox.disconnect(this._hidePanelHeightSignal);
            delete (this._hidePanelHeightSignal);
        }

        if (this._hidePanelSessionModeSignal) {
            Main.sessionMode.disconnect(this._hidePanelSessionModeSignal);
            delete (this._hidePanelSessionModeSignal);
        }

        Main.overview.searchEntry.set_style(`margin-top: 0;`);

        // hide and show can fix windows going under panel
        panelBox.hide();
        panelBox.show();
    }
}
