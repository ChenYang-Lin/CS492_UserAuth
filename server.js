const express = require("express");
const app = express();
const mongoose = require("mongoose");
const User = require("./models/user.js")
const path = require("path");
const { hashPasswordWithSalt } = require("./utils.js")




// Connect to MondoDB
const dbURI = `mongodb+srv://admin:admin@cluster0.lel0m.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
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
    
    // if error exist, show error messages. Otherwise, redirect to login page.
    if (errors.length !== 0) { 
        res.render("signup", { errors });
    } else { 
        // user signup => add to database and redirect to login page
        const hashedPassword = hashPasswordWithSalt(req.body.password, "salt");
        let user = new User({
        username: req.body.username,
        email: req.body.email,
        password: hashedPassword,
        });
        await user.save().then((data) => {
            res.render("login")
        }).catch((e) => {
            // console.log(e);
        })
    }
})
app.post("/login", async(req, res) => {
    let errors = [];

    const hashedPassword = hashPasswordWithSalt(req.body.password, "salt");
    await User.findOne({ email: req.body.email, password: hashedPassword }).then((data) => {
        if (data) {
            // console.log(data)
            user = data
            res.render("index", { user })
        } else {
            errors.push("Please enter a correct username and password.")
            res.render("login", { errors })
        }}).catch((e) => {
            console.log(e)
        })
})


