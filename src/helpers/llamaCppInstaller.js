const { spawn } = require("child_process");
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { promises: fsPromises } = require("fs");

/**
 * LlamaCppInstaller - Manages llama-server binary availability
 *
 * Note: This module is kept for backwards compatibility and system installation checks.
 * The bundled llama-server binary is primarily managed by LlamaServerManager.
 */
class LlamaCppInstaller {
  constructor() {
    this.installDir = null;
    this.binPath = null;
    this._initialized = false;
  }

  /**
   * Ensures the installer is initialized. Safe to call multiple times.
   */
  ensureInitialized() {
    if (this._initialized) return;

    if (!app.isReady()) {
      throw new Error(
        "LlamaCppInstaller cannot be initialized before app.whenReady(). " +
          "This is a programming error."
      );
    }

    this.installDir = path.join(app.getPath("userData"), "llama-cpp");
    this._initialized = true;
  }

  async ensureInstallDir() {
    this.ensureInitialized();
    await fsPromises.mkdir(this.installDir, { recursive: true });
  }

  getBinaryName() {
    // llama-server binary name
    return "llama-server.exe";
  }

  getInstalledBinaryPath() {
    this.ensureInitialized();
    return path.join(this.installDir, this.getBinaryName());
  }

  async isInstalled() {
    try {
      // First check for system installation
      const systemPath = await this.getSystemBinaryPath();
      if (systemPath) {
        this.binPath = systemPath;
        return true;
      }

      // Then check for local installation
      const binaryPath = this.getInstalledBinaryPath();
      await fsPromises.access(binaryPath, fs.constants.X_OK);
      this.binPath = binaryPath;
      return true;
    } catch {
      return false;
    }
  }

  async getSystemBinaryPath() {
    return new Promise((resolve) => {
      // Windows-only command resolution
      const checkCmd = "where";
      const binaryNames = ["llama-server.exe"];
      let found = false;
      let remaining = binaryNames.length;

      for (const name of binaryNames) {
        const proc = spawn(checkCmd, [name], {
          shell: true,
          stdio: "pipe",
        });

        let output = "";
        proc.stdout.on("data", (data) => {
          output += data.toString();
        });

        proc.on("close", (code) => {
          if (!found && code === 0 && output) {
            found = true;
            resolve(output.trim().split("\n")[0]);
          }
          remaining--;
          if (remaining === 0 && !found) {
            resolve(null);
          }
        });

        proc.on("error", () => {
          remaining--;
          if (remaining === 0 && !found) {
            resolve(null);
          }
        });
      }
    });
  }

  async checkSystemInstallation() {
    const systemPath = await this.getSystemBinaryPath();
    return systemPath !== null;
  }

  async install() {
    try {
      await this.ensureInstallDir();

      // Return a message about manual installation
      // The bundled binary is managed by LlamaServerManager
      return {
        success: false,
        message: "Please ensure the llama-server.exe binary is bundled with the app.",
      };
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error.message}`,
      };
    }
  }

  async uninstall() {
    try {
      const binaryPath = this.getInstalledBinaryPath();
      await fsPromises.unlink(binaryPath);
      this.binPath = null;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: `Uninstall failed: ${error.message}`,
      };
    }
  }

  async getBinaryPath() {
    if (this.binPath) {
      return this.binPath;
    }

    // Check for system installation
    const systemPath = await this.getSystemBinaryPath();
    if (systemPath) {
      this.binPath = systemPath;
      return systemPath;
    }

    // Fall back to local installation
    return this.getInstalledBinaryPath();
  }
}

module.exports = { default: new LlamaCppInstaller() };
