'use strict';

var crypto = require('crypto');
var heapq = require('heap');
var fs = require('fs');

var Parser = {
  keepHtml: false,
  noTree: false,
  saveReducedHtmlDir: undefined,
  nodeFromElem: function(elem) {
    var tag = elem.tagName.toLowerCase();
    var shaHash = crypto.createHash('sha1');
    shaHash.update(Date.now() + tag + Math.random());
    var node = {
      elem:elem,
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
      if ( n.signature === '' ) {
        var childSignature = {};
        n.children = n.children.reduce(function(pre, child) {
          if ( childSignature[child.signature] === undefined ) {
            childSignature[child.signature] = true;
            pre.push(child);
          } else {
            child.elem.parentNode.removeChild(child.elem);
          }
          return pre;
        },[]);
        n.signature = this.selfSignature(n, selfSignOptions);
        if ( n.children.length ) {
          n.signature += '[' + Object.keys(childSignature).sort().join(',') + ']';
        }
        //console.log(n.signature);
        //console.log(n.children.map(function(c){return c.signature;}).join('\n'));
        //console.log('=============');
      }
      if ( n.parent ) {
        leafHeap.push({node:n.parent, depth:leaf.depth - 1});
      }
      leaf = leafHeap.pop();
    }
  },
  createPage: function(window) {
    var page = {
      html: undefined,
      reducedDoc: undefined,
      idClassSet: {},
      idSet: {},
      classSet: {},
      url: window.location.href,
      cluster: undefined,
      css: [],
      js: [],
      tree: {}
    };
    var document = window.document;
    if ( this.keepHtml ) {
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
    return page;
  },
  getAllCSSSeletor:function(document) {
    var i, j, rules, matches, selectors = {};
    for (i = 0; i < document.styleSheets.length; i++) {
      rules = document.styleSheets[i].cssRules;
      for (j = 0; j < rules.length; j++) {
        if ( rules[j].selectorText ) {
          matches = rules[j].selectorText.match(/[#\.][a-zA-Z\d_-]+/g)
          if ( matches && matches.length ) {
            matches.map(function(selector) {
              selectors[selector] = true;
            });
          }
        }
      }
    }
    return selectors;
  },
  addIdClassSet: function(page, elem) {
    var i;
    if ( elem.id && this.selectorSet['#' + elem.id] ) {
    //if ( elem.id ) {
      page.idClassSet['#'+elem.id] = true;
      page.idSet['#'+elem.id] = true;
    }
    if ( elem.className ) {
      elem.classList = elem.className.split(' ');
      elem.classList = elem.classList.map(function(c) {
        return '.' + c;
      });
    }
    if ( elem.classList && elem.classList.length ) {
      for ( i = 0 ; i < elem.classList.length ; i++) {
        //if ( this.selectorSet[elem.classList[i]] ) {
          page.idClassSet[elem.classList[i]] = true;
          page.classSet[elem.classList[i]] = true;
        //}
      }
    }
  },
  processDom: function(window) {
    var leafHeap = new heapq(function(a, b) { return b.depth - a.depth; });
    var document = window.document;
    var page = this.createPage(window);
    var root = this.nodeFromElem(document.body);
    var queue = [{elem:document.body, node:root, depth:0}];
    this.selectorSet = this.getAllCSSSeletor(window.document);
    while ( queue.length ) {
      var q = queue.shift();
      var depth = q.depth + 1;
      this.addIdClassSet(page, q.elem);
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
    if ( this.saveReducedHtmlDir !== undefined ) {
      fs.writeFileSync(this.saveReducedHtmlDir + '/' + page.url.replace(/\//g,'#') + '_full.html' , document.body.parentElement.outerHTML);
    }
    page.tree = root;
    this.generateSignature(leafHeap);
    if ( this.saveReducedHtmlDir !== undefined ) {
      fs.writeFileSync(this.saveReducedHtmlDir + '/' + page.url.replace(/\//g,'#') + '_reduce.html' , document.body.parentElement.outerHTML);
    }
    if ( this.noTree ) {
      delete page.tree;
      page.tree = undefined;
    }
    return page;
    page.score = signatureScore(page.tree.signature);
    pages.push(page);
  }
};

module.exports = Parser;

