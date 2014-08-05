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
var unReservationUrlTemplate = 'http://magioplaz.zoznam.sk/rezervacie/odrezervuj/%s/%s/%s?%s';
var getReservationsUrlTemplate = 'http://magioplaz.zoznam.sk/rezervacie/ihrisko/%s/%s/%s?%s';

var request = require('request');
var util = require('util');

function checkMyReservation(cookieJar, court, date, hour, cb) {
  sails.log('Checking reservations for court ' + (court - 40));

  request.get({
    url: util.format(getReservationsUrlTemplate, court, date, date, new Date().getTime()),
    jar: cookieJar
  }, function(err, res, body) {
    if (err) {
      sails.log.error(err);
      return cb(false);
    }

    resData = JSON.parse(body);

    var termin = date + ' ' + (hour < 10 ? '0' : '') + hour + ':00:00';
    sails.log(termin);

    for (var i = 0; i < resData.length; i++) {
      if (resData[i].termin === termin && resData[i].yourOwn) {
        return cb(true);
      }
    }

    cb(false);
  });
}

function checkMyReservations(cookieJar, date, hour, cb) {
  checkMyReservation(cookieJar, courtOne, date, hour, function(myReservation) {
    if (myReservation) return cb(courtOne);

    checkMyReservation(cookieJar, courtTwo, date, hour, function(myReservation) {
      if (myReservation) return cb(courtTwo);

      cb();
    });
  });
}

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
      sails.log.error(err);
      return cb('Nepodarilo sa prihlasit');
    }

    var resBody = JSON.parse(body);

    if (resBody.errorCode) {
      return cb(resBody.errorMessage ? resBody.errorMessage : 'Nepodarilo sa prihlasit');
    }

    cb();
  });
}

function reserveCourt(cookieJar, court, date, hour, cb) {
  sails.log('Reserving court ' + court + ' on ' + date + ' at ' + hour + ' hour');

  request.post({
    url: util.format(reservationUrlTemplate, court, date, hour, new Date().getTime()),
    form: {
      comment: ''
    },
    jar: cookieJar
  }, function(err, res, body) {
    if (err) {
      sails.log.error(err);
      return cb(err);
    }

    resData = JSON.parse(body);

    if (resData.errorCode) {
      if (resData.errorCode === 7) {
        if (court === courtTwo) return reserveCourt(cookieJar, courtOne, date, hour, cb);
      }

      var errorMessage = resData.errorMessage ? resData.errorMessage : 'Nepodarilo sa rezervovat, a nikto uz nezisti ze preco';

      return checkMyReservations(cookieJar, date, hour, function(courtReserved) {
        if (courtReserved) return cb('Pokoj, ihrisko pismeno ' + (courtReserved - 40) + ' mas uz davno rezervovane');

        sails.log('Calling callback with errorMessage');
        return cb(errorMessage);
      });
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
      sails.log.error(err);
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

      reserveCourt(cookieJar, courtTwo, requestDate, match[4], function(err, courtNumber) {
        if (err) {
          sails.log.error(err);
          req.flash('error', err);
          return res.redirect('/');
        }

        req.flash('ok', 'Nech sa paci, mas rezervovane ihrisko pismeno ' + (courtNumber - 40));
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
  },

  unreserve: function(req, res, next) {
    var cookieJar = request.jar();

    req.session.reservation = null;

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

