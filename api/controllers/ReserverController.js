/**
 * ReserverController
 *
 * @module      :: Controller
 * @description	:: A set of functions called `actions`.
 *
 *                 Actions contain code telling Sails how to respond to a certain type of request.
 *                 (i.e. do stuff, then send some JSON, show an HTML page, or redirect to another URL)
 *
 *                 You can configure the blueprint URLs which trigger these actions (`config/controllers.js`)
 *                 and/or override them with custom routes (`config/routes.js`)
 *
 *                 NOTE: The code you write here supports both HTTP and Socket.io automatically.
 *
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var courtOne = 41;
var courtTwo = 42;

var reservationUrlTemplate = 'http://magioplaz.zoznam.sk/rezervacie/rezervuj/%s/%s/%s?%s';

// http://magioplaz.zoznam.sk/rezervacie/odrezervuj/42/2014-07-30/9?1406662387160
var unReservationUrlTemplate = 'http://magioplaz.zoznam.sk/rezervacie/odrezervuj/%s/%s/%s?%s';

// var cookieJar = require('request').jar();
// var request = require('request').defaults({ jar: cookieJar });
var request = require('request');
var util = require('util');

function login(cookieJar, username, password, cb) {
  request.post({
    url: 'http://magioplaz.zoznam.sk/rezervacie/authenticate',
    form: {
      username: username,
      password: password
    },
    jar: cookieJar
  }, function(err, httpRes, body) {
    if (err) {
      console.log(err);
      // req.flash('error', 'Nepodarilo sa prihlasit');
      return cb('Nepodarilo sa prihlasit');
    }

    var resBody = JSON.parse(body);

    if (resBody.errorCode) {
      // req.flash('error', resBody.errorMessage ? resBody.errorMessage : 'Nepodarilo sa prihlasit');
      // return res.redirect('/');
      return cb(resBody.errorMessage ? resBody.errorMessage : 'Nepodarilo sa prihlasit');
    }

    cb();
  });
}

function reserveCourt(cookieJar, court, date, hour, cb) {
  request.post({
    url: util.format(reservationUrlTemplate, court, date, hour, new Date().getTime()),
    form: {
      comment: ''
    },
    jar: cookieJar
  }, function(err, res, body) {
    if (err) {
      console.log(err);
      return cb(err);
    }

    resData = JSON.parse(body);

    if (resData.errorCode) {
      if (resData.errorCode === 7) {
        if (court === courtOne) return reserveCourt(cookieJar, courtTwo, date, hour, cb);
      }

      return resData.errorMessage ? cb(resData.errorMessage) : cb('Nepodarilo sa rezervovat, a nikto uz nezisti ze preco');
    }

    cb(null, court);
  });
}

function unReserveCourt(cookieJar, court, date, hour, cb) {
  request.get({
    url: util.format(unReservationUrlTemplate, court, date, hour, new Date().getTime()),
    jar: cookieJar
  }, function(err, res, body) {
    if (err) {
      console.log(err);
      return cb(err);
    }

    resData = JSON.parse(body);

    if (resData.errorCode) {
      return cb(resData.errorMessage ? resData.errorMessage : 'Nepodarilo sa odrezervovat');
    }

    cb();
  });
}

module.exports = {




  /**
   * Overrides for the settings in `config/controllers.js`
   * (specific to ReserverController)
   */
  _config: {},

  reserve: function(req, res, next) {
    sails.log(req.param('username'), req.param('password'), req.param('time'));

    var regex = /([0-9]{2}).([0-9]{2}).([0-9]{4}) ([0-9]{2}):[0-9]{2}/g;

    var match = regex.exec(req.param('time'));

    console.log(match);

    if (match === null) {
      req.flash('error', 'Napicu datum');
      return res.redirect('/');
    }

    var requestDate = match[3] + '-' + match[2] + '-' + match[1];

    var cookieJar = request.jar();

    login(cookieJar, req.param('username'), req.param('password'), function(err) {
      if (err) {
        req.flash('error', err);
        return res.redirect('/');
      }

      reserveCourt(cookieJar, courtOne, requestDate, match[4], function(err, courtNumber) {
        if (err) {
          console.log(err);
          req.flash('error', err);
          return res.redirect('/');
        }

        req.flash('ok', 'Nech sa paci, mas rezervovane ihrisko ' + (courtNumber - 40));
        req.session.reservation = {
          username: req.param('username'),
          password: req.param('password'),
          court: courtNumber,
          date: requestDate,
          hour: match[4]
        }
        res.redirect('/');
      });
    });

    // request.post({
    //   url: 'http://magioplaz.zoznam.sk/rezervacie/authenticate',
    //   form: {
    //     username: req.param('username'),
    //     password: req.param('password')
    //   },
    //   jar: cookieJar
    // }, function(err, httpRes, body) {
    //   if (err) {
    //     console.log(err);
    //     req.flash('error', 'Nepodarilo sa prihlasit');
    //     return res.redirect('/');
    //   }

    //   var resBody = JSON.parse(body);

    //   if (resBody.errorCode) {
    //     req.flash('error', resBody.errorMessage ? resBody.errorMessage : 'Nepodarilo sa prihlasit');
    //     return res.redirect('/');
    //   }

      // reserveCourt(cookieJar, courtOne, requestDate, match[4], function(err, courtNumber) {
      //   if (err) {
      //     console.log(err);
      //     req.flash('error', err);
      //     return res.redirect('/');
      //   }

      //   req.flash('ok', 'Nech sa paci, mas rezervovane ihrisko ' + (courtNumber - 40));
      //   req.session.reservation = {
      //     username: req.param('username'),
      //     password: req.param('password'),
      //     court: courtNumber,
      //     date: requestDate,
      //     hour: match[4]
      //   }
      //   res.redirect('/');
      // });
    // });
  },

  unreserve: function(req, res, next) {
    var cookieJar = request.jar();

    login(cookieJar, req.param('username'), req.param('password'), function(err) {
      if (err) {
        req.flash('error', err);
        return res.redirect('/');
      }

      unReserveCourt(cookieJar, req.param('court'), req.param('date'), req.param('hour'), function(err) {
        if (err) {
          req.flash('error', err);
          return res.redirect('/');
        }

        req.flash('ok', 'Mas to odrezervovane, ale uz sa konecne rozhodni co chces od zivota');
        res.redirect('/');
      });
    });
  }
};

