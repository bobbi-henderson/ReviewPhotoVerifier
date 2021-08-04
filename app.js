const express = require("express");
const app = express();
const multer = require("multer");
const upload = multer({
  storage: multer.diskStorage({}),
  fileFilter: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
      cb(new Error("File type is not supported"), false);
      return;
    }
    cb(null, true);
  },
});

//MS Specific
const axios = require("axios").default;
const async = require("async");
const fs = require("fs");
const https = require("https");
const path = require("path");
const createReadStream = require("fs").createReadStream;
const sleep = require("util").promisify(setTimeout);
const ComputerVisionClient =
  require("@azure/cognitiveservices-computervision").ComputerVisionClient;
const ApiKeyCredentials = require("@azure/ms-rest-js").ApiKeyCredentials;

require("dotenv").config({ path: "./config/.env" });

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const key = process.env.MS_COMPUTER_VISION_SUBSCRIPTION_KEY;
const endpoint = process.env.MS_COMPUTER_VISION_ENDPOINT;
const faceEndpoint = process.env.MS_FACE_ENDPOINT;
const subscriptionKey = process.env.MS_FACE_SUB_KEY;

const computerVisionClient = new ComputerVisionClient(
  new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": key } }),
  endpoint
);

//Server Setup
app.set("view engine", "ejs");
app.use(express.static("public"));

//Routes
app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.post("/", upload.single("file-to-upload"), async (req, res) => {
  try {
    let itemFound = false;
    let itemConfidence = 0;
    let brandFound = false;
    let brandConfidence = 0;
    // Upload image to cloudinary
    const result = await cloudinary.uploader.upload(req.file.path);
    const imageUrl = result.secure_url;

    // Analyze a URL image
    console.log("Analyzing objects in image...", imageUrl.split("/").pop());

    const objects = (
      await computerVisionClient.analyzeImage(imageUrl, {
        visualFeatures: ["Objects"],
      })
    ).objects;
    console.log();

    const brands = (
      await computerVisionClient.analyzeImage(imageUrl, {
        visualFeatures: ["Brands"],
      })
    ).brands;

    // Print the brands found
    if (brands.length) {
      console.log(
        `${brands.length} brand${brands.length != 1 ? "s" : ""} found:`
      );
      for (const brand of brands) {
        console.log(
          `    ${brand.name} (${brand.confidence.toFixed(2)} confidence)`
        );
        if(brand.name.toLowerCase() == req.body.brand.toLowerCase() || brand.name.toLowerCase() == req.body.brand.toLowerCase()+'s'){
          brandFound = true
          if(brand.confidence.toFixed(2)*100 > brandConfidence){
            brandConfidence = brand.confidence.toFixed(2)*100
          }
          console.log(brandFound, `${brand.name} matches user inputed brand, ${req.body.brand}, with ${brandConfidence}% confidence`)
        }
      }
    } else {
      console.log(`No brands found.`);
    }

    // Print objects bounding box and confidence
    if (objects.length) {
      console.log(
        `${objects.length} object${objects.length == 1 ? "" : "s"} found:`
      );
      for (const item of objects) {
        if (item.object.toLowerCase() === req.body.item.toLowerCase() || item.object.toLowerCase() === req.body.item.toLowerCase()+'s') {
          itemFound = true
          if(item.confidence.toFixed(2)*100 > itemConfidence){
            itemConfidence = item.confidence.toFixed(2)*100
          }
          console.log(itemFound, `${item.object} matches user inputed item, ${req.body.item}, with ${itemConfidence}% confidence`)
        }
        console.log(
          `    ${item.object} (${item.confidence.toFixed(
            2
          )}) at ${formatRectObjects(item.rectangle)}`
        );
      }
    } else {
      console.log("No objects found.");
    }

    function formatRectObjects(rect) {
      return (
        `top=${rect.y}`.padEnd(10) +
        `left=${rect.x}`.padEnd(10) +
        `bottom=${rect.y + rect.h}`.padEnd(12) +
        `right=${rect.x + rect.w}`.padEnd(10) +
        `(${rect.w}x${rect.h})`
      );
    }

    res.render("result.ejs", { itemFound: itemFound, itemConfidence: itemConfidence, item: req.body.item, img: imageUrl, brands: brands, brand: req.body.brand, brandFound: brandFound, brandConfidence: brandConfidence });
  } catch (err) {
    console.log(err);
  }
});

app.listen(process.env.PORT || 8000);