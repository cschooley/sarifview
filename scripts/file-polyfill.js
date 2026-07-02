// File global was added in Node 20; polyfill for older versions
if (typeof globalThis.File === 'undefined') {
    const { Blob } = require('buffer');
    globalThis.File = class File extends Blob {
        constructor(chunks, name, opts = {}) {
            super(chunks, opts);
            this.name = name;
            this.lastModified = opts.lastModified ?? Date.now();
        }
    };
}
