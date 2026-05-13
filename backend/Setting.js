const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema(
  {
    // Genel ayarlar
    defaultCurrency: {
      type: String,
      default: "TRY"
    },

    lowBatteryThreshold: {
      type: Number,
      default: 20
    },

    maxRetryAttempts: {
      type: Number,
      default: 3
    },

    mqttUpdateInterval: {
      type: Number,
      default: 30
    },

    dateFormat: {
      type: String,
      default: "YYYY-MM-DD"
    },

    timezone: {
      type: String,
      default: "(GMT+03:00) Istanbul"
    },

    // Eski yapı bozulmasın diye value objesini de koruyoruz
    value: {
      currency: {
        type: String,
        default: "TRY"
      },

      lowBatteryThreshold: {
        type: Number,
        default: 20
      },

      maxRetryCount: {
        type: Number,
        default: 3
      },

      maxRetryAttempts: {
        type: Number,
        default: 3
      },

      mqttUpdateInterval: {
        type: Number,
        default: 30
      },

      dateFormat: {
        type: String,
        default: "YYYY-MM-DD"
      },

      timezone: {
        type: String,
        default: "(GMT+03:00) Istanbul"
      }
    }
  },
  {
    collection: "settings",
    timestamps: true
  }
);

module.exports = mongoose.model("Setting", SettingSchema);