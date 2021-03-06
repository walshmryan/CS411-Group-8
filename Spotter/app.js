/**
 * Example code taken from Spotify API support
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var userRoutes = require('./routes/users');
var bodyParser = require('body-parser'); //for parsing body of a post
var fs = require('fs');

var client_id = '75a1c00129ce4975a7c787d2658ec88c'; // Your client id
var client_secret = fs.readFileSync('./../../spotify_key.txt', 'utf8'); // Client secret in local text file for security
var redirect_uri = 'http://localhost:3000/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};


var stateKey = 'spotify_auth_state';

var app = express();

app.use(bodyParser());

app.use('/users', userRoutes);

app.use(express.static(__dirname + '/public'))
    .use(cookieParser());

app.get('/login', function(req, res) {

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope = 'user-read-private user-read-email user-library-read user-top-read'; //added library read access here
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

app.get('/callback', function(req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        };

        request.post(authOptions, function(error, response, body) {
            if (!error && response.statusCode === 200) {

                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                ////////////////////////////

                /* Dependencies */
                var Promise = require('bluebird');
                var reqP = Promise.promisifyAll(require('request-promise'));


                var getTopArtists = {
                    url: 'https://api.spotify.com/v1/me/top/artists?limit=3',
                    headers: {'Authorization': 'Bearer ' + access_token},
                    json: true
                };


                //request.get(topArtists, function (error, response, body) {
                //    var top3 = body.items;
                //
                //    for (var i = 0; i < 3; i++) {
                //        console.log(top3[i].name);
                //    }
                //
                //});

                reqP(getTopArtists)
                    .then(function(topResults) {

                        var top3 = topResults.items;

                        for (var i = 0; i < 3; i++) {
                            console.log(top3[i].name);
                        }

                        return top3;

                    })
                    .then(function(top3) {

                        var postTopArtists = {
                            method: 'POST',
                            url: 'http://localhost:3000/users/db/userTop',
                            form: {
                                topArtists: top3
                            }
                        };

                        return reqP(postTopArtists)
                            .then(function(results) {
                                console.log(results);
                            });
                    })
                    .catch(function(err) {
                        throw err;
                    });




                /////////////////////////////

                var options = {
                    url: 'https://api.spotify.com/v1/me',
                    headers: { 'Authorization': 'Bearer ' + access_token },
                    json: true
                };

                // we can also pass the token to the browser to make requests from there
                res.redirect('/#' +
                    querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token
                    }));
            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));
            }
        });
    }
});

app.get('/refresh_token', function(req, res) {

    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;
            res.send({
                'access_token': access_token
            });
        }
    });
});

console.log('Listening on http://localhost:3000/');
app.listen(3000);
