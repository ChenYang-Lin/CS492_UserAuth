// All node packages used in this project
require('dotenv').config();
const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer');
const mongoose = require("mongoose");

// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  }
});

// Database models
const User = require("./models/User.js")

// Connect to MondoDB and start server
const dbURI = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.lel0m.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
mongoose.connect(dbURI)
  .then(async () => {
    app.listen(process.env.PORT || 3000, () => {
        console.log("listen on port 3000");
    })
  })
  .catch((err) => console.log(err));

  
// Global variables
let USER = null; // user reference
let verified = false; // true when 2FA checked
const saltRounds = 15; // bycrpt salt process
const expirationPeriod = 300000; // code sent via email will expired in 5 min
const resendTimer = 30000 // re-send code button disabled for 30 sec after clicked


// Register view engine
app.set('views', path.join(__dirname, '/public/views'));
app.set("view engine", "ejs");
// Middlewares
app.use(express.urlencoded({ extended: true })); // data from forms
app.use('/', express.static(__dirname + "/public"));

// Routes
app.get("/", (req, res) => {
    if (USER && verified) {
        return res.render("index", { user: USER })
    }
    res.redirect("login")
})
app.get("/login", (req, res) => {
    res.render("login")
})
app.get("/signup", (req, res) => {
    res.render("signup")
})
app.get("/verify", (req, res) => {
    res.redirect("login")
})
app.get("/logout", (req, res) => {
    USER = null;
    verified = false;
    res.redirect("login")
})

// User signup
app.post("/signup", async(req, res) => {
    let errors = [];

    // check if this email already exist.
    await User.findOne({ email: req.body.email }).then((data) => {
        if (data) {
            errors.push("Email taken, use another email.")
        }
    }).catch(e => { console.log(e) })

    // check if two passwords match
    if (req.body.password !== req.body.password2){
        errors.push("Passwords do NOT match.")
    }
    
    // if error does not exist, redirect to login page.
    try {
        if (errors.length === 0) { 
            // user signup => add to database and redirect to login page
            // Encrypt plaintext password with a secret key (salt)
            bcrypt.hash(req.body.password, saltRounds, async (err, hashedPassword) => {
                // Store user in database 
                let user = new User({
                    username: req.body.username,
                    email: req.body.email,
                    password: hashedPassword,
                });
                await user.save();
            });
            return res.render("login")
        }
        return res.render("signup", { errors });
    } catch (e) {
        console.log(e);
        return res.render("signup", { errors });
    }
})

// User login, check if email and password are correct.
app.post("/login", async (req, res) => {
    let errors = [];

    try {
        await User.findOne({ email: req.body.email }).then(async (data) => {
            if (!data) {
                errors.push("Please enter a correct username and password.")
                return res.render("login", { errors })
            }

            // user reference.
            USER = data;

            const inputPassword = req.body.password;
            const hashedPassword = USER.password;
            
            // Check if user password is correct. If correct, send code and go to verify page
            bcrypt.compare(inputPassword, hashedPassword, async (err, result) => {
                if (result) {
                    generateCodeAndEmail(USER, expirationPeriod);
                    return res.render("verify")
                }
                else {
                    errors.push("Please enter a correct username and password.")
                    return res.render("login", { errors })
                }
            });
        })
    } catch (e) {
        console.log(e)
        errors.push("something wrong...")
        return res.render("login", { errors })
    }
})

// check if verification code is correct.
app.post("/verify", async (req, res) => {
    const { code } = req.body;
    const plainOTP = code;
    let errors = [];
    
    // First, make sure there exist data for code and user
    if (!code) {
        errors.push("Please enter the code.")
        return res.render("verify", { errors })
    } 
    if (!USER) {
        return res.redirect("login")
    }

    // If code expired, prompt "code expired" and return
    if (USER.expiresAt < Date.now()) {
        errors.push("code expired...")
        return res.render("verify", { errors })
    }

    // Check if otp is correct
    bcrypt.compare(plainOTP, USER.otp, async (err, result) => {
        if (result) {
            // Everything is corrent 
            verified = true;
            return res.redirect("/");
        }
        else {
            errors.push("Wrong code. Please try again.")
            return res.render("verify", { errors })
        }
    });
})

// User request for sending another verification code.
app.post("/resend", async (req, res) => {
    // if no user, redirect to login
    if (!USER) 
        return res.redirect("login")

    // send another code to user email
    await generateCodeAndEmail(USER, expirationPeriod);
    return res.json({ resendTimer })
})

// generate code, update database, and send email to user
const generateCodeAndEmail = async (user, expirationPeriod) => {
    // Generate a random four digits code
    const plainOTP = `${Math.floor(1000 + Math.random() * 9000)}`
    // Hash the otp and update user otp and expiration time;
    bcrypt.hash(plainOTP, saltRounds, async (err, hashedOTP) => {
        // Store user in database 
        USER = await User.findByIdAndUpdate(user._id.toString(), {
                otp: hashedOTP,
                expiresAt: Date.now() + expirationPeriod, // expire in 5 minutes
            }, { new: true }
        )
    });
    // send plain-text code to user via email
    sendOneTimePasswordCode(user.email, plainOTP, expirationPeriod)
}

const sendOneTimePasswordCode = (email, otp, expirationPeriod) => {
    try {
        // Send generated code to user
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: "Email Verificaion",
            html: `<p>Code: <b>${otp}</b></p> <br> <p>This code will expire in ${Math.floor(expirationPeriod/60000)} minutes</p>`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    } catch (e) {
        console.log(e)
    }
}