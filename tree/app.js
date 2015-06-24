'use strict';
(function() {

var fs = require('fs');
var util = require('util');
var yargs = require('yargs');
var EventEmitter = require('events').EventEmitter;
var jsdom = require('node-jsdom');
var _ = require('lodash-node');
var Parser = require('./parser.js');
var Crawler = require('./crawler.js');

var argv = yargs.usage('Usage: $0 --crawl [string] --page-limit [num] --save-doc [string] --load-doc [string] --save-data [string] --full-tree --keep-html --load-data [string] --save-cluster [string]').argv;

var app = {
  emitter:new EventEmitter(),
  crawl:function() {
    var that = this;
    var crawler = Crawler.getCrawler();

    crawler.setStartUrl(argv.crawl);
    if ( argv.pageLimit && typeof argv.pageLimit === 'number' ) {
      crawler.pageLimit = argv.pageLimit;
    }

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
    } else if ( argv.loadDoc ) {
      fs.readFile(argv.loadDoc, function(err, data) {
        if ( err ) {
          throw err
        }
        that.allDocs = JSON.parse(data);
        that.emitter.emit('docReady', that.allDocs);
      });
    } else {
      console.error('ERROR: No starting url for crawler (--crawl STARTING_URL) or load local document location --load-doc PATH_TO_FILE');
    }
  },
  saveParsedData:function(filename) {
    fs.writeFile(filename,
      JSON.stringify(this.parsedDoc, function(key,value) {
        if ( key === 'parent' ) {
          return undefined;
        } else {
          return value;
        }
      })
    );
  },
  parse:function() {
    var i, config, doc, parsedDoc = [],
        that = this;
    for ( i = 0 ; i < this.allDocs.length ; i++ ) {
      doc = this.allDocs[1];
      config = {};
      config.url = doc.url;
      config.html = doc.html;
      config.done = function (errors, window) {
        parsedDoc.push(Parser.processDom(errors,window));
        if ( parsedDoc.length === that.allDocs.length) {
          that.parsedDoc = parsedDoc;
          if ( argv.saveData ) {
            that.saveParsedData(argv.saveData);
          }
          that.emitter.emit('dataReady', parsedDoc);
        }
      }
      jsdom.env(config);
    }
  },
  getData:function() {
    var that = this;
    if ( argv.loadData ) {
      fs.readFile(argv.loadData, function(err, data) {
        if ( err ) {
          throw err;
        }
        that.parsedDoc = JSON.parse(data);
        that.emitter.emit('dataReady', that.parsedDoc);
      });
    } else if ( this.allDocs ) {
      this.parse();
    }
  },
  classify:function() {
  },
  main:function() {
    var that = this;
    if ( argv.keepHtml ) {
      Parser.keepHtml = true;
    }
    this.emitter.on('docReady', function() { that.parse() });
    this.emitter.on('dataReady', function() { that.classify(); });
    this.emitter.on('clusterReady', function() { that.saveCluser(); });
    if ( argv.crawl || agrv.loadDoc ) {
      this.getDoc();
    } else if ( argv.loadData ) {
      this.getData();
    }
  }
};

app.main();

var cluster = {
  jaccard:function(a,b) {
    var factor = _.intersection(a,b).length,
        divisor = _.union(a,b).length;
    return factor / divisor;
  },
  jaccardMatrix:function() {
  },
  clique:function() {
  },
};

}());
