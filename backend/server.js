const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const mqtt = require("mqtt");
const mongoose = require("mongoose");

const Product = require("./models/Product");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || "pricelink_secret_key";

/* =======================
   SETTINGS MODEL
======================= */
const settingsSchema = new mongoose.Schema(
  {
    defaultCurrency: { type: String, default: "TRY" },
    lowBatteryThreshold: { type: Number, default: 20 },
    maxRetryAttempts: { type: Number, default: 3 },
    mqttUpdateInterval: { type: Number, default: 30 },
    dateFormat: { type: String, default: "YYYY-MM-DD" },
    timezone: { type: String, default: "(GMT+03:00) Istanbul" },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: "settings",
    timestamps: true
  }
);

const Setting = mongoose.model("Setting", settingsSchema);

/* =======================
   MQTT CONNECTION
======================= */
const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

mqttClient.on("connect", () => {
  console.log("✅ MQTT Broker connected: PriceLink Bridge Active");
});

mqttClient.on("error", (err) => {
  console.log("❌ MQTT Hatası:", err.message);
});

/* =======================
   BASIC ROUTE
======================= */
app.get("/", (req, res) => {
  res.send("PriceLink Backend: Online");
});

/* =======================
   AUTH LOGIN
======================= */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "admin123") {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1d" });

    return res.json({
      success: true,
      token,
      redirect: "dashboard.html"
    });
  }

  res.status(401).json({
    success: false,
    message: "Hatalı giriş!"
  });
});

/* =======================
   DASHBOARD STATS
======================= */
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();

const activeTags = await Product.countDocuments();

    const categories = await Product.distinct("category");

    res.json({
      success: true,
      totalProducts,
      activeTags,
      totalCategories: categories.length
    });
  } catch (err) {
    console.error("❌ Dashboard stats hatası:", err.message);

    res.status(500).json({
      success: false,
      message: "Dashboard stats could not be loaded.",
      error: err.message
    });
  }
});

/* =======================
   PRODUCTS - GET ALL
======================= */
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ Ürünler getirilemedi:", err.message);

    res.status(500).json({
      success: false,
      error: "Ürünler getirilemedi.",
      details: err.message
    });
  }
});

/* =======================
   CATEGORIES - GET DISTINCT
======================= */
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Product.distinct("category");
    res.json(categories);
  } catch (err) {
    console.error("❌ Kategoriler çekilemedi:", err.message);

    res.status(500).json({
      success: false,
      error: "Kategoriler listelenirken hata oluştu.",
      details: err.message
    });
  }
});

/* =======================
   PRODUCTS - ADD NEW
======================= */
app.post("/api/products", async (req, res) => {
  try {
    const {
      product_id,
      title,
      department,
      category,
      price,
      linkedTagId,
      location
    } = req.body;

    if (!product_id || !title) {
      return res.status(400).json({
        success: false,
        message: "Product ID / Barcode and Product Name are required."
      });
    }

    const existingProduct = await Product.findOne({ product_id });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "This SKU / Barcode already exists."
      });
    }

    const numericPrice = Number(price) || 0;

    const newProduct = new Product({
      product_id,
      title,
      department: department || "H&M",
      category: category || "General",
      linkedTagId: linkedTagId || null,
      online_price: {
        current: numericPrice,
        currency: "TRY",
        url: ""
      },
      ankara_physical_stores: location ? [location] : ["Store"],
      price_history: [
        {
          price: numericPrice,
          date: new Date()
        }
      ]
    });

    const savedProduct = await newProduct.save();

    if (linkedTagId) {
      const topic = `pricelink/tag/${linkedTagId}`;

      mqttClient.publish(topic, numericPrice.toString(), {
        qos: 1,
        retain: true
      });

      console.log(`🚀 Yeni ürün için sinyal gönderildi: ${topic} -> ₺${numericPrice}`);
    }

    res.status(201).json({
      success: true,
      message: "Product added successfully.",
      data: savedProduct
    });
  } catch (err) {
    console.error("❌ Ürün ekleme hatası:", err.message);

    res.status(500).json({
      success: false,
      message: "Product could not be added.",
      error: err.message
    });
  }
});

/* =======================
   PRODUCTS - UPDATE + MQTT
======================= */
app.put("/api/products/:id", async (req, res) => {
    console.log("📦 UPDATE BODY:", req.body);
  const {
    price,
    linkedTagId,
    title,
    product_id,
    category,
    department,
    location
  } = req.body;

  const { id } = req.params;

  console.log(`📥 Güncelleme isteği: ID=${id}, Fiyat=${price}, Tag=${linkedTagId}`);

  try {
    const numericPrice = Number(price) || 0;

    let updatedProduct;

    if (id === "test_id") {
      updatedProduct = await Product.findOneAndUpdate(
        { title: "ESP32 Test Device" },
        {
          $set: {
            title: "ESP32 Test Device",
            product_id: "ESP32_TEST",
            "online_price.current": numericPrice,
            "online_price.currency": "TRY",
            linkedTagId: linkedTagId || null
          },
          $push: {
            price_history: {
              price: numericPrice,
              date: new Date()
            }
          }
        },
        {
          new: true,
          upsert: true,
          strict: false,
          runValidators: true
        }
      );

      console.log("📡 TEST MODU: DB kaydedildi & sinyal hazır.");
    } else {
      const updateData = {
        "online_price.current": numericPrice,
        linkedTagId: linkedTagId || null
      };

      if (title !== undefined) updateData.title = title;
      if (product_id !== undefined) updateData.product_id = product_id;
      if (category !== undefined) updateData.category = category;
      if (department !== undefined) updateData.department = department;

      if (location !== undefined) {
        updateData.ankara_physical_stores = location ? [location] : ["Store"];
      }

      updatedProduct = await Product.findByIdAndUpdate(
        id,
        {
          $set: updateData,
          $push: {
            price_history: {
              price: numericPrice,
              date: new Date()
            }
          }
        },
        {
          new: true,
          runValidators: true
        }
      );
    }

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Ürün bulunamadı!"
      });
    }

    if (linkedTagId) {
      const topic = `pricelink/tag/${linkedTagId}`;

      mqttClient.publish(topic, numericPrice.toString(), {
        qos: 1,
        retain: true
      });

      console.log(`🚀 Sinyal gönderildi: ${topic} -> ₺${numericPrice}`);
    }

    res.json({
      success: true,
      message: "Product updated successfully.",
      data: updatedProduct
    });
  } catch (err) {
    console.error("❌ Güncelleme hatası:", err.message);

    res.status(500).json({
      success: false,
      error: "Sunucu hatası: " + err.message
    });
  }
});

/* =======================
   PRODUCTS - DELETE
======================= */
app.delete("/api/products/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully."
    });
  } catch (err) {
    console.error("❌ Silme hatası:", err.message);

    res.status(500).json({
      success: false,
      message: "Delete failed.",
      error: err.message
    });
  }
});

/* =======================
   CAMPAIGNS - APPLY
======================= */
app.post("/api/campaigns/apply", async (req, res) => {
  try {
    const { category, campaignType, discountValue } = req.body;
    const value = Number(discountValue);

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required."
      });
    }

    if (isNaN(value)) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be a number."
      });
    }

    const products = await Product.find({ category }).lean();

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "No products found in this category."
      });
    }

    let updatedCount = 0;

    function extractPrice(product) {
      let rawPrice = product.online_price;

      if (rawPrice && typeof rawPrice === "object") {
        rawPrice = rawPrice.current ?? rawPrice.price ?? rawPrice.value;
      }

      if (rawPrice === undefined || rawPrice === null) {
        rawPrice = product.price ?? product.currentPrice ?? product.originalPrice;
      }

      if (typeof rawPrice === "string") {
        rawPrice = rawPrice.replace(/[^\d.-]/g, "");
      }

      const numericPrice = Number(rawPrice);

      if (Number.isNaN(numericPrice) || numericPrice <= 0) {
        return null;
      }

      return numericPrice;
    }

    for (const product of products) {
      const oldPrice = extractPrice(product);

      if (!oldPrice) {
        console.log(`❌ Price could not be read for: ${product.title}`);
        continue;
      }

      let newPrice;

      if (campaignType === "percentage") {
        newPrice = oldPrice - oldPrice * (value / 100);
      } else if (campaignType === "fixed") {
        newPrice = value;
      } else {
        newPrice = oldPrice - value;
      }

      newPrice = Math.max(0, Number(newPrice.toFixed(2)));

      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            online_price: newPrice
          },
          $push: {
            price_history: {
              price: newPrice,
              oldPrice: oldPrice,
              date: new Date(),
              campaign: true,
              campaignType,
              discountValue: value
            }
          }
        }
      );

      updatedCount++;
      console.log(
  `✅ Campaign updated: ${product.title} | Old: ₺${oldPrice} -> New: ₺${newPrice}`
);

      if (product.linkedTagId) {
        mqttClient.publish(
          `pricelink/tag/${product.linkedTagId}`,
          String(newPrice),
          { qos: 1, retain: true }
        );
      }
    }

    return res.json({
      success: true,
      message: "Campaign applied successfully.",
      updatedCount
    });
  } catch (err) {
    console.error("Campaign apply error:", err);

    return res.status(500).json({
      success: false,
      message: "Campaign could not be applied.",
      error: err.message
    });
  }
});

/* =======================
   SETTINGS - GET
======================= */
app.get("/api/settings", async (req, res) => {
  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({});
    }

    res.json(settings);
  } catch (err) {
    console.error("❌ Settings getirilemedi:", err.message);

    res.status(500).json({
      success: false,
      message: "Settings could not be fetched.",
      error: err.message
    });
  }
});

/* =======================
   SETTINGS - UPDATE
======================= */
app.put("/api/settings", async (req, res) => {
  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create(req.body);
    } else {
      if (req.body.defaultCurrency !== undefined) {
        settings.defaultCurrency = req.body.defaultCurrency;
      }

      if (req.body.lowBatteryThreshold !== undefined) {
        settings.lowBatteryThreshold = req.body.lowBatteryThreshold;
      }

      if (req.body.maxRetryAttempts !== undefined) {
        settings.maxRetryAttempts = req.body.maxRetryAttempts;
      }

      if (req.body.mqttUpdateInterval !== undefined) {
        settings.mqttUpdateInterval = req.body.mqttUpdateInterval;
      }

      if (req.body.dateFormat !== undefined) {
        settings.dateFormat = req.body.dateFormat;
      }

      if (req.body.timezone !== undefined) {
        settings.timezone = req.body.timezone;
      }

      if (req.body.value !== undefined) {
        settings.value = req.body.value;
      }

      await settings.save();
    }

    res.json({
      success: true,
      message: "Settings updated successfully.",
      data: settings
    });
  } catch (err) {
    console.error("❌ Settings güncelleme hatası:", err.message);

    res.status(500).json({
      success: false,
      message: "Settings could not be updated.",
      error: err.message
    });
  }
});

/* =======================
   SETTINGS - RESET PRODUCT TAG PAIRS
======================= */
app.post("/api/settings/reset-pairs", async (req, res) => {
  try {
    await Product.updateMany(
      {},
      {
        $set: {
          linkedTagId: null
        }
      }
    );

    res.json({
      success: true,
      message: "Tüm product-tag eşleşmeleri sıfırlandı."
    });
  } catch (err) {
    console.error("❌ Reset işlemi başarısız:", err.message);

    res.status(500).json({
      success: false,
      error: "Reset işlemi başarısız.",
      details: err.message
    });
  }
});

/* =======================
   DATABASE + SERVER START
======================= */
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://PriceLinkTeam:TEDU2026@cluster0.xyvhqfa.mongodb.net/PriceLinkDB?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000
  })
  .then(() => {
    console.log("✅ MongoDB Bağlantısı Başarılı!");

    app.listen(PORT, () => {
      console.log(`💻 Sunucu http://localhost:${PORT} üzerinde çalışıyor.`);
    });
  })
  .catch((err) => {
    console.log("❌ VERİTABANI BAĞLANTI HATASI:");
    console.log("Mesaj:", err.message);
    console.log(
      "İpucu: IP adresin değişmiş olabilir veya internetin MongoDB portunu engelliyor."
    );
  });