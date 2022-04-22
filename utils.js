// 2FA Part 1: hash password with salt before save to database
const hashStringWithSalt = (password, salt) => {
    let encryptedPassword = password
    // Encrypt plaintext password with a secret key (salt)

    return encryptedPassword;
}

// 2FA Part 2: email confirmation
// Email Setup
const OTP = require("./models/OTP.js")
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  }
});

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
    } catch (error) {
        // Error
    }
}

const generateCodeAndEmail = async (userID, expirationPeriod) => {
    // Generate a random four digits code
    const plainOTP = `${Math.floor(1000 + Math.random() * 9000)}`
    
    // hash and save OTP to database
    const hashedOTP = hashStringWithSalt(plainOTP, "salt");
    const otp = await OTP.findOneAndUpdate( { userID: user._id.toString() },
        {
            userID: userID,
            otp: hashedOTP,
            createdAt: Date.now(),
            expiresAt: Date.now() + expirationPeriod, // expire in 5 minutes
        }, {
        new: true,   // return new doc if one is upserted
        upsert: true // insert the document if it does not exist
        }
    );

    // send plain-text code to user via email
    // sendOneTimePasswordCode(user.email, plainOTP, expirationPeriod)
}

module.exports = {
    hashStringWithSalt,
    sendOneTimePasswordCode,
    generateCodeAndEmail,
}