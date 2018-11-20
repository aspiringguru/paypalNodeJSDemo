const express = require('express');
const ejs = require('ejs');
const paypal = require('paypal-rest-sdk');

const fs = require('fs');
const contents = fs.readFileSync('paypalConfig.json');
var jsonContent = JSON.parse(contents);
console.log("client_id:", jsonContent.paypalClientID);
console.log("client_secret:", jsonContent.paypalSecret);

const contentsMail = fs.readFileSync('mailConfig.json');
var jsonContentMail = JSON.parse(contentsMail);
console.log("client_id:", jsonContentMail.username);
console.log("client_secret:", jsonContentMail.password);

var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
 service: 'gmail',
 auth: {
        user: jsonContentMail.username,
        pass: jsonContentMail.password
    }
});


paypal.configure({
'mode': 'sandbox', //sandbox or live ie: change to live when going live
'client_id': jsonContent.paypalClientID,
'client_secret': jsonContent.paypalSecret
});

const app = express();

app.set('view engine', 'ejs');

app.get('/', (req, res) => res.render('index'));

app.post('/pay', (req, res) => {
  //refer https://github.com/paypal/PayPal-node-SDK
  //Invoke the rest api (eg: create a PayPal payment)
  // with required parameters (eg: data, config_options, callback).
  const create_payment_json = {
    "intent": "sale",
    "payer": {
        "payment_method": "paypal"
    },
    "redirect_urls": {
        "return_url": "http://localhost:3000/success",
        "cancel_url": "http://localhost:3000/cancel"
    },
    "transactions": [{
        "item_list": {
            "items": [{
                "name": "Red Sox Hat",
                "sku": "001",
                "price": "25.00",
                "currency": "USD",
                "quantity": 1
            }]
        },
        "amount": {
            "currency": "USD",
            "total": "25.00"
        },
        "description": "Hat for the best team ever"
    }]
};

//refer https://github.com/paypal/PayPal-node-SDK/blob/master/samples/payment/execute.js
paypal.payment.create(create_payment_json, function (error, payment) {
  if (error) {
      console.log("error in paypal.payment.create")
      throw error;
  } else {
      /*
      console.log("Create Payment Response.");
      console.log(payment);
      res.send("test");
      //this prints array of urls to console.
      //we want the url with dictionary key 'rel' =  approval_url
      // example extract of payment =
       links:
        [ { href: blah,
            rel: 'self',
            method: 'GET' },
          { href: blah,
            rel: 'approval_url',
            method: 'REDIRECT' },
          { href: blah,
            rel: 'execute',
            method: 'POST' } ],
      */

      for(let i = 0;i < payment.links.length;i++){
        console.log("payment.links[",i,"].rel = ", payment.links[i].rel)
        if(payment.links[i].rel === 'approval_url'){
          res.redirect(payment.links[i].href);
        }
      }

  }
});//end paypal.payment.create

});//end of route app.post('/pay'


app.get('/success', (req, res) => {
  console.log("app.get('/success',...");
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;
  const token = req.query.token;
  console.log("app.get('/success : req.query.payerId = ", payerId);
  console.log("app.get('/success : req.query.paymentId = ", paymentId);
  console.log("app.get('/success : req.query.token = ", token);

  //from  https://github.com/paypal/PayPal-node-SDK/blob/master/samples/payment/execute.js
  //nb: upgrade would make the json below generated from database of item prices
  const execute_payment_json = {
    "payer_id": payerId,
    "transactions": [{
        "amount": {
            "currency": "USD",
            "total": "25.00"
        }
    }]
  };

  paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
    if (error) {
        console.log("error trapped in paypal.payment.execute")
        console.log(error.response);
        throw error;
    } else {
        console.log("paypal.payment.execute : Get Payment Response");
        console.log(JSON.stringify(payment));
        console.log("payment.id:", payment.id);
        console.log("payment.payer.payer_info.email = ", payment.payer.payer_info.email);
        console.log("payment.payer.payer_info.first_name = ", payment.payer.payer_info.first_name);
        console.log("payment.payer.payer_info.first_name = ", payment.payer.payer_info.first_name);
        console.log("payment.payer.payer_info.shipping_address = ", JSON.stringify(payment.payer.payer_info.shipping_address));

        const mailOptions = {
          from: 'bmatthewtaylor@gmail.com', // sender address
          to: payment.payer.payer_info.email, // list of receivers
          subject: 'paypal payment received.'+payment.id, // Subject line
          html: '<p>Some html messagezzzzzz.</p>'// plain text body
        };

        //turn on permission for 'less secure apps'
        //https://myaccount.google.com/lesssecureapps?pli=1
        transporter.sendMail(mailOptions, function (err, info) {
           if(err) {
             console.log("error")
             console.log(err)
           } else {
             console.log("no error")
             console.log(info);
           }
        });


        res.send("paypal.payment.execute : Success");
    }
  });//end paypal.payment.execute

  //res.send("success");//this was for early demo only.
  //http://localhost:3000/success?paymentId=PAY-3P4185219V5974812LPZXCYQ&token=EC-08W828027E266902A&PayerID=FXQQR9RGY4J42
});//end of app.get('/success',

app.get('/cancel', (req, res) => {
    console.log("app.get('/cancel',");
    res.send('Cancelled');
});

app.listen(3000, () => console.log('Server Started'));
