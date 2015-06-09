'use strict';
(function() {
/*
let Crawler = require('simplecrawler');

let crawler = Crawler.crawl('http://www.kohls.com/');
crawler.interval = 1000;
crawler.maxDepth = 1;
crawler.discoverResources = false;

crawler.on('fetchcomplete', function(queueItem, responseBuffer, response) {
  console.log('Completed fetching resource:', queueItem.url);
  //let resume = this.wait();
  filterUrl(responseBuffer, function(foundURLs) {
    foundURLs.forEach(crawler.queueURL.bind(crawler));
    //resume();
  });
});

crawler.on('complete', function() {
  console.log('complete');
  console.log(arguments);
  process.exit(0);
});

crawler.start();

let filterUrl = function(data, fn) {
  console.log(data.toString());
}
return;
*/
let fs = require('fs');
let crypto = require('crypto');
let util = require('util');
let jsdom = require('node-jsdom');
let heapq = require('heap');
let yargs = require('yargs');
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

let argv = yargs.usage('Usage: $0 --save-tree [string] --full-tree --save-doc [string] --local-doc [string] --keep-html').argv;

log(argv);

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

let signTokenize = function(str) {
  let last = 0;
  return Array.prototype.reduce.call(str, function(pre, char) {
    if ( char === '[' || char === '.' || char === '#' ) {
      pre.push(char);
      last += 1;
    } else if ( char === ']' ) {
    } else {
      pre[last] += char
    }
    return pre;
  }, ['']);
}

let lcs = function(rowStr, colStr) {
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
  return {str:lcs.pop(), score:table[prev].pop()};
};

let lcsTokenize = function(rowStr, colStr) {
  let cur = 0, prev = 1, i, j;
  let table = [[],[]];
  let lcs = [];
  rowStr = signTokenize(rowStr);
  colStr = signTokenize(colStr);
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
  return {str:lcs.pop(), score:table[prev].pop()};
};

let lcsWeighted = function(rowStr, colStr) {
  let cur = 0, prev = 1, i, j;
  let table = [[],[]];
  let lcs = [];
  rowStr = signTokenize(rowStr);
  colStr = signTokenize(colStr);
  for (i = 0; i <= rowStr.length; i++) {
    table[0][i] = 0;
    table[1][i] = 0;
    lcs[i] = '';
  }
  for (i = 0; i < colStr.length; i++) {
    let score = 1;
    switch(colStr[0]) {
      case '.':
        score = 10;
        break;
      case '#':
        score = 50;
        break;
    }
    for (j = 0; j < rowStr.length; j++) {
      if ( table[prev][j+1] > table[cur][j] ) {
        table[cur][j+1] = table[prev][j+1];
      } else {
        table[cur][j+1] = table[cur][j];
        lcs[j+1] = lcs[j];
      }
      if (colStr[i] === rowStr[j] && (table[prev][j] + score) > table[cur][j+1] ) {
        table[cur][j+1] = table[prev][j] + score;
        lcs[j+1] = lcs[j] + rowStr[j];
      }
    }
    cur = (cur + 1) % 2;
    prev = (prev + 1) % 2;
  }
  return {str:lcs.pop(), score:table[prev].pop()};
};

let signatureScore = function(str) {
  return Array.prototype.reduce.call(str,function(pre, char) {
    switch(char) {
      case '[':
        pre += 1;
        break;
      case '.':
        pre += 10;
        break;
      case '#':
        pre += 100;
        break;
    }
    return pre;
  },1);
}

//lcs2(urls[0],urls[1]);
//return;

let nodeFromElem = function(elem) {
  let tag = elem.tagName.toLowerCase();
  let shaHash = crypto.createHash('sha1');
  shaHash.update(Date.now() + tag + Math.random());
  let node = {
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
      n.signature = selfSignature(n, selfSignOptions);
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
  page.js = Array.prototype.reduce.call(
    document.getElementsByTagName('script'),
    function( pre, el ) {
      if ( el.src ) {
        pre.push(el.src);
      }
      return pre;
    },
    []
  );
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
      node.parentHash = q.node.hash;
      q.node.children.push(node);
      queue.push({elem:elem, node:node, depth:depth});
    }
    if ( q.elem.children.length === 0 ) {
      leafHeap.push({node:q.node, depth:depth});
    }
  }
  page.tree = root;
  generateSignature(leafHeap);
  page.score = signatureScore(page.tree.signature);
  pages.push(page);
  //log(root.signature);
  if ( pages.length === urls.length ) {
    if ( argv.outputTree ) {
      fs.writeFile(argv.outputTree,
        JSON.stringify(pages, function(key, value) {
          if ( key === 'parent' ) {
            return undefined;
          } else {
            return value;
          }
        })
      );
    }
    //comparePage();
  }
  //log(util.inspect(page.tree, {depth: 5}));
}

let comparePage = function() {
  for ( let i = 0; i < pages.length ; i++ ) {
    let pi = pages[i];
    for ( let j = i + 1; j < pages.length ; j++) {
      let pj = pages[j];
      log('pi: ' + pi.url);
      log('pi.signature length: ' + pi.tree.signature.replace(/\]/g,'').length);
      log('pj: ' + pj.url);
      log('pj.signature length: ' + pj.tree.signature.replace(/\]/g,'').length);
      //let str1 = lcs1(pi.tree.signature, pj.tree.signature);
      let obj = lcs(pi.tree.signature, pj.tree.signature);
      log(obj.score);
      //log(obj.str);
      //log(str1.length);
      obj = lcsTokenize(pi.tree.signature, pj.tree.signature);
      log(signatureScore(obj.str));
      obj = lcsWeighted(pi.tree.signature, pj.tree.signature);
      log(pi.score, pj.score);
      log(obj.score);
     // log(obj.str);
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
