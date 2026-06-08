import * as fs from 'fs';
import * as path from 'path';
import { getHomeDirectory } from './utils';

export interface Setting {
  key: string;
  value: string;
  error?: string;
}

export class Options {
  private configFile: string;
  private internalConfigFile: string;
  private logFile: string;
  public resourcesLocation: string;

  constructor() {
    const home = getHomeDirectory();
    const wakaFolder = path.join(home, '.wakatime');
    try {
      if (!fs.existsSync(wakaFolder)) {
        fs.mkdirSync(wakaFolder, { recursive: true });
      }
      this.resourcesLocation = wakaFolder;
    } catch (e) {
      console.error(e);
      throw e;
    }

    this.configFile = path.join(home, '.wakatime.cfg');
    this.internalConfigFile = path.join(this.resourcesLocation, 'wakatime-internal.cfg');
    this.logFile = path.join(this.resourcesLocation, 'wakatime.log');
  }

  public getSetting(section: string, key: string, internal?: boolean): string | undefined {
    try {
      const content = fs.readFileSync(this.getConfigFile(internal ?? false), 'utf-8');
      if (content.trim()) {
        let currentSection = '';
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
            currentSection = line
              .trim()
              .substring(1, line.trim().length - 1)
              .toLowerCase();
          } else if (currentSection === section) {
            const parts = line.split('=');
            const currentKey = parts[0].trim();
            if (currentKey === key && parts.length > 1) {
              return this.removeNulls(parts[1].trim());
            }
          }
        }

        return undefined;
      }
    } catch (_) {
      return undefined;
    }
  }

  public setSetting(section: string, key: string, val: string, internal: boolean): void {
    const configFile = this.getConfigFile(internal);
    fs.readFile(configFile, 'utf-8', (err: NodeJS.ErrnoException | null, content: string) => {
      if (err) content = '';

      const contents: string[] = [];
      let currentSection = '';
      let found = false;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
          if (currentSection === section && !found) {
            contents.push(this.removeNulls(key + ' = ' + val));
            found = true;
          }
          currentSection = line
            .trim()
            .substring(1, line.trim().length - 1)
            .toLowerCase();
          contents.push(this.removeNulls(line));
        } else if (currentSection === section) {
          const parts = line.split('=');
          const currentKey = parts[0].trim();
          if (currentKey === key) {
            if (!found) {
              contents.push(this.removeNulls(key + ' = ' + val));
              found = true;
            }
          } else {
            contents.push(this.removeNulls(line));
          }
        } else {
          contents.push(this.removeNulls(line));
        }
      }

      if (!found) {
        if (currentSection !== section) {
          contents.push('[' + section + ']');
        }
        contents.push(this.removeNulls(key + ' = ' + val));
      }

      fs.writeFile(configFile, contents.join('\n'), (writeErr) => {
        if (writeErr) throw writeErr;
      });
    });
  }

  public getConfigFile(internal: boolean): string {
    return internal ? this.internalConfigFile : this.configFile;
  }

  public getLogFile(): string {
    return this.logFile;
  }

  private startsWith(outer: string, inner: string): boolean {
    return outer.slice(0, inner.length) === inner;
  }

  private endsWith(outer: string, inner: string): boolean {
    return inner === '' || outer.slice(-inner.length) === inner;
  }

  private removeNulls(s: string): string {
    return s.replace(/\0/g, '');
  }
}
