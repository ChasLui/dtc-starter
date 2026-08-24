"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Local fork: Medusa's database layer is hardwired to @mikro-orm/postgresql
// (the PostgreSqlDriver is injected by definePostgreSqlConfig). To run the
// whole stack on SQLite, re-export @mikro-orm/sqlite under the same subpath.
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
