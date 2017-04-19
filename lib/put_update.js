/*jslint node: true, indent: 2 , nomen  : true, evil : true */
'use strict';
var R = require('ramda'),
  convertViews = require('./convertViews'),
  createMD5 = require('./createMD5');

module.exports = function (self) {
  /**
   * PUT method used to alter documents with atomic server-side functions
   */
  return function (req, res, next) {
    var dbname, db, doc, id, change, current, update_func, message;

    dbname = req.params.db;
    db = self.databases[dbname];
    id = req.params.id;
    
    update_func = db['_design/' + req.params.doc].updates[req.params.name];

    current = db[id];

    current._rev = (function (d) {
      var rev, rev_num;
      rev = d._rev;
      rev_num = parseInt(rev.substring(0, rev.indexOf('-')), 10) + 1;
      return rev_num + '-' + createMD5(JSON.stringify(d));
    }(current));
    
    [doc, message] = update_func(R.cloneDeep(current), {body: req._body});
   
    if (doc !== null) {
      db[id] = doc;

      change = {
        seq     : self.sequence[dbname],
        id      : id,
        changes : [],
        doc     : R.cloneDeep(current)
      };

      change.doc._rev = current._rev;
      change.changes.push({ rev : current._rev });
      // don't emit changes for _local documents
      if (id.indexOf('_local') !== 0) {
        self.changes[dbname].push(change);
      }
    }
    res.setHeader('ETag', '"' + current._rev + '"');
    res.send(201, message);
    next();
  };
};
