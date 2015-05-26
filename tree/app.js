'use strict';

let util = require('util');
let jsdom = require('node-jsdom');
let heapq = require('heap');
let log = console.log;

let nodeFromElem = function(elem) {
  let node = {
    tagName: elem.tagName.toLowerCase(),
    id: elem.id,
    classList: elem.classList || [],
    children: [],
    signature: '',
    parent:undefined
  }
  node.classList = node.classList.sort();
  return node;
};

let selfSignature = function(node, options) {
  let s = node.tagName;
  let op = options || {};
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
}

let generateSignature = function(leafHeap) {
  let leaf = leafHeap.pop();
  while (leaf) {
    let n = leaf.node;
    if ( n.signature === '') {
      let childSignature = {};
      n.children = n.children.reduce(function(pre, child) {
        if ( childSignature[child.signature] === undefined ) {
          childSignature[child.signature] = true;
          pre.push(child);
        }
        return pre;
      },[]);
      n.signature = selfSignature(n) +
                      Object.keys(childSignature).map(function(sign) {
                        return '>' + sign.replace('>','::');
                      }).sort().join('');
      log(n.signature);
      log(n.children.map(function(c){return c.signature;}).join('\n'));
      log('=============');
    }
    if ( n.parent ) {
      leafHeap.push({node:n.parent, depth:leaf.depth - 1});
    }
    leaf = leafHeap.pop();
  }
}

jsdom.env({
  url:'https://news.ycombinator.com/news',
  done:function(errors, window) {
    let leafHeap = new heapq(function(a, b) {
      return b.depth - a.depth;
    });
    let document = window.document;
    let page = {
      url:window.location.href,
      html:document.body.parentElement.outerHTML,
      document: window.document,
      css:[],
      js:[],
      tree:{},
    };
    page.css = Array.prototype.reduce.call(document.getElementsByTagName('link'), function(pre, el) {
      if ( el.rel === 'stylesheet' ) {
        pre.push(el.href);
      }
      return pre;
    },[]);
    page.js = Array.prototype.map.call(document.getElementsByTagName('script'), function(el) {
      return el.href;
    });
    let root = nodeFromElem(document.body);
    let queue = [{elem:document.body, node:root, depth:0}];
    while ( queue.length ) {
      let q = queue.shift();
      let depth = q.depth + 1;
      for ( let i = 0 ; i < q.elem.children.length ; i++ ) {
        let elem = q.elem.children[i];
        let node = nodeFromElem(q.elem.children[i]);
        node.parent = q.node;
        q.node.children.push(node);
        queue.push({elem:elem, node:node, depth:depth});
      }
      if ( q.elem.children.length === 0 ) {
        leafHeap.push({node:q.node, depth:depth});
      }
    }
    page.tree = root;
    generateSignature(leafHeap);
    //log(util.inspect(page.tree, {depth: 5}));
  }
});

/*
let Crawler = require("simplecrawler");

Crawler.crawl("http://www.kohls.com/", function(queueItem){
  console.log("Completed fetching resource:",queueItem.url);
});
*/
