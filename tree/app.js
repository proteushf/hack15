'use strict';

(function() {
let util = require('util');
let jsdom = require('node-jsdom');
let heapq = require('heap');
let log = console.log;
let pages = [];
let urls = [
  'http://www.kohls.com/catalog/shoes-shoes.jsp?CN=4294719776+4294719777&N=4294719777+4294719776+3000079215&icid=hpmf|mfs5',
  'http://www.kohls.com/sale-event/for-the-home.jsp',
  'http://www.kohls.com/catalog/juniors-plus-dresses-clothing.jsp?CN=4294719935+4294737717+4294719462+4294719810',
  'http://www.kohls.com/sale-event/juniors-teens-clothing.jsp',
  'http://www.kohls.com/catalog.jsp?N=3000080340&icid=hpmf|mfs1'
];
let urlLimit = 1000;
let crawlDepth = 6;
let basePage = 'http://www.kohls.com/';

let lcs0 = function(str1, str2) {
  // init max value
  var longestCommonSubstring = 0;
  // init 2D array with 0
  var table = [],
      len1 = str1.length,
      len2 = str2.length,
      row, col;
  for (row = 0; row <= len1; row++) {
    table[row] = [];
    for (col = 0; col <= len2; col++) {
      table[row][col] = 0;
    }
  }
  // fill table
  var i, j;
  for (i = 0; i < len1; i++) {
    for (j = 0; j < len2; j++) {
      if (str1[i] == str2[j]) {
        if (table[i][j] == 0) {
          table[i+1][j+1] = 1;
        } else {
          table[i+1][j+1] = table[i][j] + 1;
        }
        if (table[i+1][j+1] > longestCommonSubstring) {
          longestCommonSubstring = table[i+1][j+1];
        }
      } else {
        table[i+1][j+1] = 0;
      }
    }
  }
  return longestCommonSubstring;
};

let lcs_greedy = function(x,y) {
  var symbols = {},i,
    r=0,p=0,p1,L=0,idx,
    m=x.length,n=y.length,
    S = new Buffer(m<n?n:m);
  p1 = popsym(0);
  for(i=0;i < m;i++){
    p = (r===p)?p1:popsym(i);
    p1 = popsym(i+1);
    idx=(p > p1)?(i++,p1):p;
    if(idx===n){p=popsym(i);}
    else{
      r=idx;
      S[L++]=x.charCodeAt(i);
    }
  }
  return S.toString('utf8',0,L);
 
  function popsym(index){
    var s = x[index],
      pos = symbols[s]+1;
    pos = y.indexOf(s,pos>r?pos:r);
    if(pos===-1){pos=n;}
    symbols[s]=pos;
    return pos;
  }
};

let lcs1 = function(x,y) {
  let s,i,j,m,n,
    lcs=[],row=[],c=[],
    left,diag,latch;
  //make sure shorter string is the column string
  m = x.length;
  n = y.length;
  if(m<n){s=x;x=y;y=s;}
  m = x.length;
  n = y.length;
  //build the c-table
  for(j=0;j<n;row[j++]=0);
  for(i=0;i<m;i++){
    c[i] = row = row.slice();
    for(diag=0,j=0;j<n;j++,diag=latch){
      latch=row[j];
      if(x[i] == y[j]){row[j] = diag+1;}
      else{
        left = row[j-1]||0;
        if(left>row[j]){row[j] = left;}
      }
    }
  }
  i--,j--;
  //row[j] now contains the length of the lcs
  //recover the lcs from the table
  while(i>-1&&j>-1){
    switch(c[i][j]){
      default: j--;
        lcs.unshift(x[i]);
      case (i&&c[i-1][j]): i--;
        continue;
      case (j&&c[i][j-1]): j--;
    }
  }
  return lcs.join('');
};

let lcs2 = function(rowStr, colStr) {
  let cur = 0, prev = 1, i, j;
  let table = [[],[]];
  let lcs = [];
  for (i = 0; i <= rowStr.length; i++) {
    table[0][i] = 0;
    table[1][i] = 0;
    lcs[i] = '';
  }
  for (i = 0; i < colStr.length; i++) {
    for (j = 0; j < rowStr.length; j++) {
      if ( table[prev][j+1] > table[cur][j] ) {
        table[cur][j+1] = table[prev][j+1];
      } else {
        table[cur][j+1] = table[cur][j];
        lcs[j+1] = lcs[j];
      }
      if (colStr[i] === rowStr[j] && (table[prev][j] + 1) > table[cur][j+1] ) {
        table[cur][j+1] = table[prev][j] + 1;
        lcs[j+1] = lcs[j] + rowStr[j];
      }
    }
    cur = (cur + 1) % 2;
    prev = (prev + 1) % 2;
  }
  return lcs.pop();
};

//lcs2(urls[0],urls[1]);
//return;

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
  let selfSignOptions = {
    getId:function(id) {
      id = id.replace(/_\d+/,'');
      return '#' + id;
    }
  };
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
      n.signature = selfSignature(n, selfSignOptions)
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
}

let processDom = function(errors, window) {
  let leafHeap = new heapq(function(a, b) {
    return b.depth - a.depth;
  });
  let document = window.document;
  let page = {
    url: window.location.href,
    html: document.body.parentElement.outerHTML,
    document: window.document,
    cluster: undefined,
    css: [],
    js: [],
    tree: {}
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
      if ( elem.tagName === 'script' || elem.tagName === 'link' ) {
        continue;
      }
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
  pages.push(page);
  //log(root.signature);
  if ( pages.length === urls.length ) {
    comparePage();
  }
  //log(util.inspect(page.tree, {depth: 5}));
}

let comparePage = function() {
  for ( let i = 0; i < pages.length ; i++ ) {
    let pi = pages[i];
    for ( let j = i + 1; j < pages.length ; j++) {
      let pj = pages[j];
      log('pi: ' + pi.url);
      log('pi.signature length: ' + pi.tree.signature.length);
      log('pj: ' + pj.url);
      log('pj.signature length: ' + pj.tree.signature.length);
      //log(lcs0(pi.tree.signature, pj.tree.signature));
      //let str1 = lcs1(pi.tree.signature, pj.tree.signature);
      let str2 = lcs2(pi.tree.signature, pj.tree.signature);
      //log(str1);
      log(str2);
      //log(str1.length);
      log(str2.length);
      //log(lcs_greedy(pi.tree.signature, pj.tree.signature).length);
    }
  }
}

for ( let i = 0; i < urls.length ; i++ ) {
  jsdom.env({
    url: urls[i],
    done: processDom
  });
}

}());
/*
let Crawler = require("simplecrawler");

Crawler.crawl("http://www.kohls.com/", function(queueItem){
  console.log("Completed fetching resource:",queueItem.url);
});
*/
