'use strict';
var URL = require('url');
var jsdom = require('node-jsdom');
var EventEmitter = require('events').EventEmitter;

var CrawlQueue = function() {
  this.init();
};

CrawlQueue.prototype = {
  init:function() {
    this.queue = [];
    this.hash = {};
  },
  pushAry:function(urls, depth) {
    var i, url;
    if ( Array.isArray(urls) ) {
      for ( i = 0 ; i < urls.length ; i++) {
        this.push(urls[i], depth);
      }
    }
  },
  push:function(url, depth) {
    if ( this.hash[url] === undefined ) {
      this.queue.push({url:url, depth:depth});
      this.hash[url] = depth;
    }
  },
  pop:function() {
    return this.take(this.queue.length - 1);
  },
  shift:function() {
    return this.take(0);
  },
  sample:function() {
    var idx, q;
    do {
      idx = Math.floor(this.queue.length * Math.random());
      q = this.queue[idx];
    } while (this.hash[q.url] === true);
    return this.take(idx);
  },
  take:function(idx) {
    var q = this.queue[idx];
    console.log('take idx: ' + idx);
    console.log(q);
    this.hash[q.url] = true;
    this.queue.splice(idx,1);
    return q;
  }
};

var Crawler = function() {
};

Crawler.prototype = {
  queue:null,
  host:null,
  baseUrl:null,
  depthLimit:5,
  sampling:true,
  pageLimit:50,
  pageCount:0,
  allDocs:[],
  setConfig:function(config) {
    config = config || {};
    Object.keys(this).map(function(key) {
      console.log(typeof this[key] !== 'function', typeof config[key] !== 'undefined');
      if (typeof this[key] !== 'function' && typeof config[key] !== 'undefined' ) {
        this[key] = config[key];
      }
    },this);
    if ( config.url ) {
      this.setStartUrl(url);
    }
  },
  setStartUrl:function(baseUrl) {
    this.baseUrl = URL.parse(baseUrl);
  },
  initCrawl:function() {
    this.queue = new CrawlQueue();
    this.queue.push(this.baseUrl.href, 0);
    this.pageCount = 0;
    this.allDocs = [];
  },
  start:function() {
    this.initCrawl();
    this._crawl();
  },
  _crawl:function() {
    var q, that = this;
    if ( this.sampling ) {
      q = this.queue.sample();
    } else {
      q = this.queue.shift();
    }
    if ( this.pageCount < this.pageLimit) {
      this.pageCount += 1;
      jsdom.env({
        url:q.url,
        done: function(errors, window) {
          var document, urls;
          console.log('done: ' + window.location.href);
          if ( errors ) {
            console.log('error on url: ' + window.location.href);
            console.log(errors);
          }
          that.allDocs.push({url:window.location.href, html:window.document.body.parentElement.outerHTML});
          urls = that._getLinks(window.document);
          that.queue.pushAry(urls, q.depth + 1);
          that.emit('pageLoaded', window);
          that._crawl();
        }
      });
    } else {
      this.emit('done');
    }
  },
  _getLinks:function(document) {
    var that = this;
    var urls = Array.prototype.reduce.call(document.getElementsByTagName('a'), function(pre, a) {
      if ( a && a.href ) {
        var parsedUrl = URL.parse(a.href);
        if ( parsedUrl.host === that.baseUrl.host && parsedUrl.protocol.indexOf('http') !== -1 ) {
          pre.push(parsedUrl.href);
        }
      }
      return pre;
    },[]);
    return urls;
  }
};

Crawler.prototype.__proto__ = EventEmitter.prototype;
module.exports = {
  getCrawler:function() {
    return new Crawler();
  }
}

