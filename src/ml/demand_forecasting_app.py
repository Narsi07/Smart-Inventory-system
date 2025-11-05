# ===========================================
# INTERACTIVE DEMAND FORECASTING APP
# ===========================================
# Author: Narasimman
# Description: Streamlit app to predict future demand
# based on user input and trained model.

import streamlit as st
import pandas as pd
import numpy as np
import joblib
import datetime
from sklearn.preprocessing import StandardScaler

# ===========================================
# 1. Load Trained Model and Scaler
# ===========================================
@st.cache_resource
def load_model():
    model = joblib.load(r"C:\Users\NARASIMMAN\Downloads\demand_forecast_model.pkl")
    scaler = joblib.load(r"C:\Users\NARASIMMAN\Downloads\scaler.pkl")
    return model, scaler

model, scaler = load_model()

st.title("📊 Demand Forecasting Dashboard")
st.markdown("Enter the product and market details below to predict **future demand**.")

# ===========================================
# 2. Input Section
# ===========================================

col1, col2 = st.columns(2)

with col1:
    product_name = st.text_input("🛒 Product Name", "Almonds")
    stock = st.number_input("📦 Current Stock (units)", min_value=0, value=100)
    cost_price = st.number_input("💰 Cost Price (per unit)", min_value=0.0, value=5.0)
    selling_price = st.number_input("🏷️ Selling Price (per unit)", min_value=0.0, value=7.0)
    supplier_rating = st.slider("⭐ Supplier Reliability (1–10)", 1, 10, 8)

with col2:
    sales_velocity = st.number_input("📈 Avg Daily Sales Velocity (units/day)", min_value=0.0, value=120.0)
    days_to_expire = st.number_input("⏳ Days until Expiration", min_value=0, value=30)
    seasonal_index = st.slider("🌦️ Seasonal Demand Factor (1–5)", 1, 5, 3)
    marketing_boost = st.slider("📢 Promotion/Marketing Impact (1–5)", 1, 5, 2)
    competitor_intensity = st.slider("⚔️ Competition Level (1–5)", 1, 5, 3)

# ===========================================
# 3. Prepare Input Data for Prediction
# ===========================================

# Current date as input base
today = datetime.date.today()
month = today.month
dayofweek = today.weekday()

# Simulated lag features (you can adjust from historical data if available)
lag_1 = sales_velocity * 0.95
lag_7 = sales_velocity * 0.85
rolling_mean_7 = (lag_1 + lag_7) / 2

# Combine all features into DataFrame
input_data = pd.DataFrame({
    "month": [month],
    "dayofweek": [dayofweek],
    "lag_1": [lag_1],
    "lag_7": [lag_7],
    "rolling_mean_7": [rolling_mean_7]
})


# ===========================================
# 4. Scale and Predict
# ===========================================
scaled_input = scaler.transform(input_data)
predicted_demand = model.predict(scaled_input)[0]

# ===========================================
# 5. Display Result
# ===========================================
st.markdown("---")
st.subheader(f"🔮 Predicted Demand for **{product_name}**")
st.metric("Estimated Units (Next Period)", f"{predicted_demand:.2f} units")

# ===========================================
# 6. Insights / Recommendations
# ===========================================
st.markdown("### 📋 Inventory Insights")
if predicted_demand > stock:
    st.warning("⚠️ Stock may run out soon — consider reordering!")
elif predicted_demand < (stock * 0.5):
    st.success("✅ Stock levels are sufficient for the forecast period.")
else:
    st.info("ℹ️ Maintain current stock; demand seems stable.")

# ===========================================
# 7. Optional: Future Forecast Chart
# ===========================================
future_days = st.slider("Forecast how many days ahead?", 7, 60, 30)
if st.button("Generate Future Forecast"):
    future_preds = []
    temp_input = input_data.copy()

    for i in range(future_days):
        scaled_input = scaler.transform(temp_input)
        next_pred = model.predict(scaled_input)[0]
        future_preds.append(next_pred)

        # update lag values
        temp_input["lag_1"] = next_pred
        temp_input["lag_7"] = temp_input["lag_1"]
        temp_input["rolling_mean_7"] = np.mean(future_preds[-7:]) if len(future_preds) >= 7 else np.mean(future_preds)

    future_dates = pd.date_range(start=today + datetime.timedelta(days=1), periods=future_days)
    forecast_df = pd.DataFrame({"Date": future_dates, "Predicted Demand": future_preds})

    st.line_chart(forecast_df.set_index("Date"))

    st.markdown("✅ Forecast generated successfully!")

# ===========================================
# END
# ===========================================
