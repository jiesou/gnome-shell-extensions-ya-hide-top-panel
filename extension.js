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

export default class YaHideTopbarExtension extends Extension {
    enable() {
        // TKS: https://gitlab.gnome.org/jrahmatzadeh/just-perfection/-/blob/main/src/lib/API.js#L425
        const panelBox = Main.layoutManager.panelBox;

        if (panelBox.get_parent() === Main.layoutManager.uiGroup) {
            Main.layoutManager.removeChrome(panelBox);
            Main.layoutManager.overviewGroup.insert_child_at_index(panelBox, 0);
        }
        panelBox.translation_y = 0;

        Main.layoutManager._updateHotCorners();

        const searchEntryParent = Main.overview.searchEntry.get_parent();

        const panelHeight = Main.panel.height;
        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        searchEntryParent.set_style(`margin-top: ${Math.round(panelHeight / scaleFactor)}px;`);

        // hide and show can fix windows going under panel
        panelBox.hide();
        panelBox.show();

        if (this._hidePanelWorkareasChangedSignal) {
            global.display.disconnect(this._hidePanelWorkareasChangedSignal);
            delete (this._hidePanelWorkareasChangedSignal);
        }
        this._hidePanelWorkareasChangedSignal = global.display.connect(
            'workareas-changed',
            () => {
                this.enable();
            }
        );

        if (!this._hidePanelHeightSignal) {
            this._hidePanelHeightSignal = panelBox.connect(
                'notify::height',
                () => {
                    this.enable();
                }
            );
        }
    }

    disable() {
        const panelBox = Main.layoutManager.panelBox;

        panelBox.translation_y = 0;

        Main.layoutManager.overviewGroup.remove_child(panelBox);
        Main.layoutManager.addChrome(panelBox, {
            affectsStruts: true,
            trackFullscreen: true,
        });

        if (this._hidePanelWorkareasChangedSignal) {
            global.display.disconnect(this._hidePanelWorkareasChangedSignal);
            delete (this._hidePanelWorkareasChangedSignal);
        }

        if (this._hidePanelHeightSignal) {
            panelBox.disconnect(this._hidePanelHeightSignal);
            delete (this._hidePanelHeightSignal);
        }

        const searchEntryParent = Main.overview.searchEntry.get_parent();
        searchEntryParent.set_style(`margin-top: 0;`);

        // hide and show can fix windows going under panel
        panelBox.hide();
        panelBox.show();
    }
}
