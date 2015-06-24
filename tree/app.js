'use strict';
(function() {

var fs = require('fs');
var util = require('util');
var yargs = require('yargs');
var EventEmitter = require('events').EventEmitter;
var jsdom = require('node-jsdom');
var Parser = require('./parser.js');
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
          that.emitter.emit('parseDone', parsedDoc);
        }
      }
      jsdom.env(config);
    }
  },
  saveParsedData:function() {
    if ( argv.saveTree ) {
      fs.writeFile(argv.saveTree,
        JSON.stringify(this.parsedDoc, function(key,value) {
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
    if ( argv.keepHtml ) {
      Parser.keepHtml = true;
    }
    this.emitter.on('docReady', function() { that.parse() });
    this.emitter.on('parseDone', function() { that.saveParsedData(); });
    this.getDoc();
  }
};

app.main();
}());
