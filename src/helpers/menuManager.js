const { Menu } = require("electron");
const { i18nMain } = require("./i18nMain");

class MenuManager {
  static setupMainMenu(onOpenSettings) {
    // Windows: no application-level menu needed; the control panel has its own.
  }

  static setupControlPanelMenu(controlPanelWindow, onOpenSettings) {
    // For Windows, keep the window-specific menu.
    const template = [
      {
        label: i18nMain.t("menu.file"),
        submenu: [
          {
            label: i18nMain.t("menu.settings"),
            accelerator: "Ctrl+,",
            click: () => onOpenSettings?.(),
          },
          { type: "separator" },
          { role: "close", label: i18nMain.t("menu.closeWindow") },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { type: "separator" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    controlPanelWindow.setMenu(menu);
  }
}

module.exports = MenuManager;
