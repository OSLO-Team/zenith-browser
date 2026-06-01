const path = require('path');
const fs = require('fs');

function cloneData(data) {
  if (data === undefined) return undefined;
  return JSON.parse(JSON.stringify(data));
}

class Store {
  constructor(fileName, defaults = {}) {
    // If electron is already initialized, get app. If not, require it.
    let app;
    try {
      app = require('electron').app;
    } catch (e) {
      // In case called outside electron main context
    }
    
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    this.filePath = path.join(userDataPath, fileName + '.json');
    this.data = this.parseDataFile(this.filePath, defaults);
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    this.write();
  }

  replace(data) {
    this.data = cloneData(data) || {};
    this.write();
  }

  write() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error writing store file:', error);
    }
  }

  // Push to an array value
  push(key, item) {
    if (!Array.isArray(this.data[key])) {
      this.data[key] = [];
    }
    this.data[key].push(item);
    this.set(key, this.data[key]);
  }

  // Filter an array value
  filter(key, predicate) {
    if (Array.isArray(this.data[key])) {
      this.data[key] = this.data[key].filter(predicate);
      this.set(key, this.data[key]);
    }
  }

  parseDataFile(filePath, defaults) {
    const defaultData = cloneData(defaults) || {};
    try {
      if (fs.existsSync(filePath)) {
        const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return Object.assign(defaultData, loaded);
      }
    } catch (error) {
      console.error('Error reading store file, resetting to defaults:', error);
    }
    return defaultData;
  }
}

module.exports = Store;
