'use strict';

var _ = require('lodash');
var cheerio = require('cheerio');
var debug = require('debug')('craigslist-json-search');
var q = require('q');
var request = q.nbind(require('request'));
var url = require('url');

module.exports = Object.create({
  
  defaults: {
    city: 'losangeles',
    supportedQueryOptions: ['minAsk', 'maxAsk', 's', 'sort']
  },

  query: function (query, options) {
    var self, host, searchQryUrl, deferred;

    function success(res) {
      var status, body, $, fn, result;

      status = res[0].statusCode;

      if (status >= 400) {
        var err = new Error('Search query error: ' + status);
        err.status = status;
        return deferred.reject(err);
      }

      body = res[1];

      debug('Got %d response:\n%s', status, body);

      $ = cheerio.load(body);
      fn = typeof self.options.parse === 'function' ?
        self.options.parse : parse;

      result = $('.content .row').map(function () {
        return fn($(this));
      });

      deferred.resolve(result.get());
    }

    function error(err) {
      debug('Search query failed: %s', err);
      deferred.reject(err);
    }

    function parse($post) {
      var baesUrl, $anchor, $pl, $cat;

      baesUrl = 'http://' + host;
      $anchor = $post.find('a.i');
      $pl = $post.find('.txt .pl');
      $cat = $post.find('.l2 .gc');

      return {
        pid: $post.attr('data-pid'),
        href: baesUrl + $anchor.attr('href'),
        price: $anchor.find('.price').text(),
        text: $pl.find('.hdrlnk').text(),
        time: Date.parse($pl.find('time').attr('datetime')),
        category: {
          href: baesUrl + $cat.attr('href'),
          id: $cat.attr('data-cat'),
          text: $cat.text()
        }
      };
    }

    this.setOptions(options);

    self = this;
    host = this.getHost();
    searchQryUrl = this.getSearchQueryUrl(host, query);
    deferred = q.defer();

    debug('Search query url: %s', searchQryUrl);

    request(searchQryUrl)
    .then(success)
    .catch(error)
    .done();

    return deferred.promise;
  },

  getHost: function () {
    return this.options.city + '.craigslist.org';
  },

  getSearchQueryUrl: function (host, query) {
    var obj;

    query = query || '';
    
    obj = {
      protocol: 'http',
      host: host,
      pathname: 'search/sss',
      query: { query: query }
    };

    this.options.supportedQueryOptions.forEach(function (option) {
      var opt = this.options[option];

      /* jshint eqnull: true */
      if (opt != null) { obj.query[option] = opt; }
    }, this);

    return url.format(obj);
  },

  setOptions: function (options) {
    this.options = options || {};
    _.defaults(this.options, this.defaults);
  }
});
