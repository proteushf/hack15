'use strict';
(function() {

var fs = require('fs');
var crypto = require('crypto');
var jsdom = require('node-jsdom');
var util = require('util');
var yargs = require('yargs');
var heapq = require('heap');
var EventEmitter = require('events').EventEmitter;
var log = console.log;

var Crawler = require('./crawler.js');
var argv = yargs.usage('Usage: $0 --crawl [string] --save-doc [string] --local-doc [string] --doc-processor [string] --save-tree [string] --full-tree --keep-html').argv;

var app = {
  emitter:new EventEmitter(),
  crawl:function() {
    var that = this;
    var crawler = Crawler.getCrawler();

    crawler.setStartUrl(argv.crawl);
    crawler.pageLimit = 2;

    var processedPage = [];

    crawler.on('done',function() {
      if ( argv.saveDoc ) {
        fs.writeFile(argv.saveDoc,JSON.stringify(crawler.allDocs));
      }
      that.allDocs = crawler.allDocs;
      that.emitter.emit('docReady', that.allDocs);
    });
    crawler.start();
  },
  getDoc:function() {
    var that = this;
    if ( argv.crawl ) {
      this.crawl();
    } else if ( argv.localDoc ) {
      fs.readFile(argv.localDoc, function(err, data) {
        if ( err ) {
          throw err
        }
        that.allDocs = JSON.parse(data);
        that.emitter.emit('docReady', that.allDocs);
      });
    } else {
      console.error('ERROR: No starting url for crawler (--crawl STARTING_URL) or local document location --local-doc PATH_TO_FILE');
    }
  },
  parse:function() {
    var i, config, doc, output = [],
        that = this;
    for ( i = 0 ; i < this.allDocs.length ; i++ ) {
      doc = this.allDocs[1];
      config = {};
      config.url = doc.url;
      config.html = doc.html;
      config.done = function (errors, window) {
        output.push(docProcessor.processDom(errors,window));
        if ( output.length === that.allDocs.length) {
          that.emitter.emit('parseDone', output);
        }
      }
      jsdom.env(config);
    }
  },
  saveParsedData:function(output) {
    if ( argv.saveTree ) {
      fs.writeFile(argv.saveTree,
        JSON.stringify(output, function(key,value) {
          if ( key === 'parent' ) {
            return undefined;
          } else {
            return value;
          }
        })
      );
    }
  },
  main:function() {
    var that = this;
    this.emitter.on('docReady', function() { that.parse() });
    this.emitter.on('parseDone', function(output) { that.saveParsedData(output); });
    this.getDoc();
  }
};

app.main();

var docProcessor = {
  nodeFromElem: function(elem) {
    var tag = elem.tagName.toLowerCase();
    var shaHash = crypto.createHash('sha1');
    shaHash.update(Date.now() + tag + Math.random());
    var node = {
      hash: shaHash.digest('hex'),
      tagName: tag,
      id: elem.id,
      classList: elem.classList || [],
      children: [],
      signature: '',
      parent: undefined
    }
    node.classList = node.classList.sort();
    return node;
  },
  selfSignature: function(node, options) {
    var s = node.tagName;
    var op = options || {};
    if ( node.id && !op.skipId ) {
      if ( typeof op.getId === 'function' ) {
        s += op.getId(node.id);
      } else {
        s += '#' + node.id;
      }
    }
    if ( node.classList && node.classList.length ) {
      if ( typeof op.getClassName === 'function' ) {
        s += op.getClassName(node.classList);
      } else {
        s += '.' + node.classList.join('.');
      }
    }
    return s;
  },
  generateSignature: function(leafHeap) {
    var leaf = leafHeap.pop();
    var selfSignOptions = {
      getId:function(id) {
        id = id.replace(/_\d+/,'');
        return '#' + id;
      }
    };
    while (leaf) {
      var n = leaf.node;
      if ( n.signature === '') {
        var childSignature = {};
        n.children = n.children.reduce(function(pre, child) {
          if ( childSignature[child.signature] === undefined ) {
            childSignature[child.signature] = true;
            pre.push(child);
          }
          return pre;
        },[]);
        n.signature = this.selfSignature(n, selfSignOptions);
        if ( n.children.length ) {
          n.signature += '[' + Object.keys(childSignature).sort().join(',') + ']';
        }
        //log(n.signature);
        //log(n.children.map(function(c){return c.signature;}).join('\n'));
        //log('=============');
      }
      if ( n.parent ) {
        leafHeap.push({node:n.parent, depth:leaf.depth - 1});
      }
      leaf = leafHeap.pop();
    }
  },
  processDom: function(errors, window) {
    var leafHeap = new heapq(function(a, b) { return b.depth - a.depth; });
    var document = window.document;
    var page = {
      url: window.location.href,
      cluster: undefined,
      css: [],
      js: [],
      tree: {}
    };
    if ( argv.keepHtml ) {
      page.html = document.body.parentElement.outerHTML;
    }
    page.css = Array.prototype.reduce.call(document.getElementsByTagName('link'), function(pre, el) {
      if ( el.rel === 'stylesheet' ) {
        pre.push(el.href);
      }
      return pre;
    },[]);
    page.js = Array.prototype.reduce.call( document.getElementsByTagName('script'),function( pre, el ) {
        if ( el.src ) {
          pre.push(el.src);
        }
        return pre;
    }, []);
    var root = this.nodeFromElem(document.body);
    var queue = [{elem:document.body, node:root, depth:0}];
    while ( queue.length ) {
      var q = queue.shift();
      var depth = q.depth + 1;
      for ( var i = 0 ; i < q.elem.children.length ; i++ ) {
        var elem = q.elem.children[i];
        if ( elem.tagName === 'script' || elem.tagName === 'link' ) {
          continue;
        }
        var node = this.nodeFromElem(q.elem.children[i]);
        node.parent = q.node;
        node.parentHash = q.node.hash;
        q.node.children.push(node);
        queue.push({elem:elem, node:node, depth:depth});
      }
      if ( q.elem.children.length === 0 ) {
        leafHeap.push({node:q.node, depth:depth});
      }
    }
    page.tree = root;
    this.generateSignature(leafHeap);
    return page;
    page.score = signatureScore(page.tree.signature);
    pages.push(page);
  }
};

}());
