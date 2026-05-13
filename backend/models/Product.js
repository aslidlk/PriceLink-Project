const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    // Ürün adı
    title: {
      type: String,
      required: true,
      trim: true
    },

    // Barkod / SKU
    product_id: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },

    // Departman
    department: {
      type: String,
      default: "H&M",
      trim: true
    },

    // Kategori
    category: {
      type: String,
      default: "General",
      trim: true
    },

    // RFID / E-ink tag eşleşmesi
    linkedTagId: {
      type: String,
      default: null
    },

    // Online fiyat bilgisi
    online_price: {
      current: {
        type: Number,
        required: true,
        default: 0
      },

      currency: {
        type: String,
        default: "TRY"
      },

      url: {
        type: String,
        default: ""
      }
    },

    // Fiziksel mağaza bilgileri
    ankara_physical_stores: {
      type: Array,
      default: []
    },

    // Fiyat geçmişi
    price_history: {
      type: Array,
      default: []
    }
  },
  {
    collection: "products",
    timestamps: true
  }
);

module.exports = mongoose.model("Product", ProductSchema);