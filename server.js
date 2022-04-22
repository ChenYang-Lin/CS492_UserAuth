require('dotenv').config();
const express = require("express");
const app = express();
const path = require("path");

const mongoose = require("mongoose");
const User = require("./models/User.js")
const OTP = require("./models/OTP.js")
const { hashStringWithSalt, sendOneTimePasswordCode, generateCodeAndEmail } = require("./utils.js")

// const expirationPeriod = 20000; // 10 sec
const expirationPeriod = 300000; // code sent via email will expired in 5 min
const resendTimer = 30000 // re-send code button disabled for 30 sec after clicked

// Connect to MondoDB
const dbURI = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.lel0m.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
mongoose.connect(dbURI)
  .then(async () => {
    app.listen(process.env.PORT || 3000, () => {
        console.log("listen on port 3000");
    })
  })
  .catch((err) => console.log(err));

// Register view engine
app.set('views', path.join(__dirname, '/public/views'));
app.set("view engine", "ejs");
// Middlewares
app.use(express.urlencoded({ extended: true })); // data from forms
app.use('/', express.static(__dirname + "/public"));

// Routes
app.get("/", (req, res) => {
    res.render("index")
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
    
    // if error does exist, redirect to login page.
    if (errors.length === 0) { 
        // user signup => add to database and redirect to login page
        const hashedPassword = hashStringWithSalt(req.body.password, "salt");
        let user = new User({
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
        });
        await user.save().catch((e) => {
            // console.log(e);
        })
        return res.render("login")
    } 

    return res.render("signup", { errors });
})
app.post("/login", async (req, res) => {
    let errors = [];

    const hashedPassword = hashStringWithSalt(req.body.password, "salt");
    await User.findOne({ email: req.body.email, password: hashedPassword }).then(async (data) => {
        if (!data) {
            errors.push("Please enter a correct username and password.")
            return res.render("login", { errors })
        }
        user = data

        await generateCodeAndEmail(user._id.toString(), expirationPeriod);

        return res.render("verify", { userID: user._id.toString() })
        
    }).catch((e) => {
        console.log(e)
    }) 
})
app.post("/verify", async (req, res) => {
    const { userID, code } = req.body;
    const plainOTP = code;
    let errors = [];
    
    // First, make sure there exist data for code and user
    if (!code) {
        errors.push("Please enter the code.")
        return res.render("verify", { errors, userID })
    } 
    if (!user) {
        return res.redirect("/login")
    }

    // Query one time password for this user
    await OTP.findOne({ userID: userID }).then(async (data) => {
        const { otp, expiresAt } = data;
        // If code expired, prompt "code expired" and return
        if (expiresAt < Date.now()) {
            errors.push("code expired...")
            return res.render("verify", { errors, userID })
        } 
        // Check if code is correct
        const hashedOTP = hashStringWithSalt(plainOTP, "salt");
        if (hashedOTP !== otp) {
            errors.push("Wrong code. Please try again.")
            return res.render("verify", { errors, userID })
        }
        // Get user data and redirect to home page
        await User.findById(userID, (err, result) => {
            if (err) {
                console.log(err);
                return res.render("verify", { errors, userID })
            } 
            res.render("index", { result })
        })
    }).catch((e) => {
        // console.log(e)
    }) 
})
app.post("/resend", async (req, res) => {
    const userID = req.body.userID;
    await generateCodeAndEmail(userID, expirationPeriod);
    res.json({ resendTimer })
})

