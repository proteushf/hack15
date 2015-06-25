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

var argv = yargs.usage('Usage: $0 --crawl [string] --page-limit [num] --save-doc [string] --load-doc [string] --save-data [string] --no-tree --full-tree --keep-html --load-data [string] --save-cluster [string]').argv;

var app = {
  docCount:0,
  crawlerDone:false,
  emitter:new EventEmitter(),
  crawl:function() {
    var that = this;
    var crawler = Crawler.getCrawler();

    //var urls = [];
    //crawler.fixQueue(urls);
    crawler.setStartUrl(argv.crawl);
    if ( argv.pageLimit && typeof argv.pageLimit === 'number' ) {
      crawler.pageLimit = argv.pageLimit;
    }

    var processedPage = [];

    crawler.on('pageLoaded', function(window) {
      var doc = {url:window.location.href, html:window.document.body.parentElement.outerHTML};
      if ( argv.saveDoc) {
        fs.appendFileSync(
          argv.saveDoc + '.row',
          JSON.stringify(doc)
        );
      }
      that.docCount += 1;
      if ( that.docCount === crawler.pageLimit) {
        that.crawlerDone = true;
      }
      that.parseDoc(window);
      window.close();
    });

    crawler.on('done', function() {
      /*
      if ( argv.saveDoc ) {
        fs.writeFile(argv.saveDoc,JSON.stringify(crawler.allDocs));
      }
      that.allDocs = crawler.allDocs;
      that.emitter.emit('docReady', that.allDocs);
      */
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
  saveParsedData:function(filename, data) {
    fs.writeFile(filename,
      JSON.stringify(data, function(key,value) {
        if ( argv.noTree ) {
          if ( key === 'tree' ) {
            return undefined;
          }
        }
        if ( key === 'parent' ) {
          return undefined;
        } else {
          return value;
        }
      })
    );
  },
  parseDoc:function(window) {
    var i, config, that = this;
    this.parsedDoc.push(Parser.processDom(window));
    if (this.crawlerDone && this.docCount === this.parsedDoc.length ) {
      this.emitter.emit('dataReady', this.parsedDoc);
      if ( argv.saveData ) {
        this.saveParsedData(argv.saveData + '.row', this.parsedDoc);
      }
    }
    /*
    config = {};
    config.url = doc.url;
    config.html = doc.html;
    config.done = function (errors, window) {
      that.parsedDoc.push(Parser.processDom(errors,window));
      console.log('Parsed: ' + window.location.href);
      if (that.crawlerDone && that.docCount === that.parsedDoc.length ) {
        that.emitter.emit('dataReady', that.parsedDoc);
        if ( argv.saveData ) {
          that.saveParsedData(argv.saveData + '.row', that.parsedDoc);
        }
      }
      window.close();
    };
    jsdom.env(config);
    */
  },
  parseAll:function() {
    var i, config, doc, parsedDoc = [],
        that = this;
    for ( i = 0 ; i < this.allDocs.length ; i++ ) {
      doc = this.allDocs[i];
      config = {};
      config.url = doc.url;
      config.html = doc.html;
      config.done = function (errors, window) {
        parsedDoc.push(Parser.processDom(errors,window));
        if ( parsedDoc.length === that.allDocs.length) {
          that.parsedDoc = parsedDoc;
          if ( argv.saveData ) {
            that.saveParsedData(argv.saveData, that.parsedDoc);
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
      this.parseAll();
    }
  },
  classify:function() {
    return;
    var i, matrix = analyzer.similarityMatrix(this.parsedDoc);
    for ( i = 0; i < this.parsedDoc.length; i++) {
      console.log('\ni: ' + i + ', url: ' + this.parsedDoc[i].url);
      console.log(matrix[i].reduce(function(pre, num, idx) {
        pre += idx + ': ' + num.toPrecision(4) + ', ';
        return pre;
      },''));
    }
    //console.log(Object.keys(this.parsedDoc[4].idClassSet).sort());
    //console.log(Object.keys(this.parsedDoc[3].idClassSet).sort());
  },
  main:function() {
    var that = this;
    this.parsedDoc = [];
    this.docCount = 0;
    if ( argv.keepHtml ) {
      Parser.keepHtml = true;
    }
    if ( argv.tree === false) {
      Parser.noTree = true;
    }
    if ( argv.saveDoc ) {
      fs.closeSync(fs.openSync(argv.saveDoc + '.row', 'w'));
    }
    if ( argv.saveData ) {
      fs.closeSync(fs.openSync(argv.saveData + '.row', 'w'));
    }
    this.emitter.on('docReady', function() { that.parseAll() });
    this.emitter.on('dataReady', function() { that.classify(); });
    //this.emitter.on('clusterReady', function() { that.saveCluset(); });
    if ( argv.crawl || argv.loadDoc ) {
      this.getDoc();
    } else if ( argv.loadData ) {
      this.getData();
    }
  }
};

app.main();

var analyzer = {
  similarity: function(a,b) {
    var factor = _.intersection(a,b).length,
        divisor = _.union(a,b).length;
    return factor / divisor;
  },
  similarityMatrix: function(parsedDoc) {
    var matrix = [], i, j, score;
    for ( i = 0 ; i < parsedDoc.length; i++) {
      matrix.push([]);
    }
    for ( i = 0 ; i < parsedDoc.length; i++) {
      for ( j = i ; j < parsedDoc.length; j++) {
        score = this.similarity(Object.keys(parsedDoc[i].idClassSet), Object.keys(parsedDoc[j].idClassSet));
        //console.log('i: ' + i + ', j: ' + j + ', score: ' + score);
        matrix[i][j] = score;
        matrix[j][i] = score;
      }
    }
    return matrix;
  },
  clique:function() {
  }
};

}());
