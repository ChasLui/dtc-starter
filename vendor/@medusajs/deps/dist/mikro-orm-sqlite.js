"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("@mikro-orm/sqlite"), exports);
function __exportStar(m, o) {
  for (var p in m)
    if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p))
      __createBinding(o, m, p);
}
function __createBinding(o, m, k) {
  if (k === undefined) k = k;
  var desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = {
      enumerable: true,
      get: function () {
        return m[k];
      },
    };
  }
  Object.defineProperty(o, k, desc);
}
