# ===========================================
# ENHANCED DEMAND FORECASTING MODEL (Standalone)
# ===========================================
# Author: Narasimman
# Description: Preprocesses sales data, trains a Random Forest model,
# evaluates performance, and forecasts future product demand in units/items.

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

# Optional (if you want to compare)
# from xgboost import XGBRegressor


# ===========================================
# 1. Load Dataset
# ===========================================
# 🔹 Change the file path to your dataset
data = pd.read_csv("/content/synthetic_sales_data.csv")

print("✅ Data loaded successfully!")
print(data.head())


# ===========================================
# 2. Data Preprocessing
# ===========================================
# Detect date column
date_cols = [col for col in data.columns if "date" in col.lower() or "time" in col.lower()]
if date_cols:
    data[date_cols[0]] = pd.to_datetime(data[date_cols[0]], errors="coerce")
    data.sort_values(by=date_cols[0], inplace=True)
    data.set_index(date_cols[0], inplace=True)
else:
    print("⚠️ No date column found, using sequential index.")
    data["Index_Date"] = pd.date_range(start="2020-01-01", periods=len(data))
    data.set_index("Index_Date", inplace=True)

# Detect target column (demand/sales/quantity)
target_cols = [col for col in data.columns if any(x in col.lower() for x in ["demand", "sales", "quantity", "units"])]
if target_cols:
    target_col = target_cols[0]
else:
    raise ValueError("❌ No demand/sales/quantity column found!")

print(f"📊 Target Column: {target_col}")

# Fill missing values
data.fillna(method="ffill", inplace=True)
data.fillna(0, inplace=True)

# Feature Engineering
data["month"] = data.index.month
data["dayofweek"] = data.index.dayofweek
data["lag_1"] = data[target_col].shift(1)
data["lag_7"] = data[target_col].shift(7)
data["rolling_mean_7"] = data[target_col].rolling(window=7).mean()
data.dropna(inplace=True)

# Features & Target
X = data.drop(columns=[target_col])
y = data[target_col]


# ===========================================
# 3. Train-Test Split (Time-based)
# ===========================================
split_ratio = 0.8
split_point = int(len(X) * split_ratio)

X_train, X_test = X.iloc[:split_point], X.iloc[split_point:]
y_train, y_test = y.iloc[:split_point], y.iloc[split_point:]

print(f"🧩 Training samples: {len(X_train)}, Testing samples: {len(X_test)}")

# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)


# ===========================================
# 4. Model Training
# ===========================================
rf_model = RandomForestRegressor(
    n_estimators=250,
    max_depth=10,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
)
rf_model.fit(X_train_scaled, y_train)

# Optional: Compare with XGBoost
# xgb_model = XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=8, random_state=42)
# xgb_model.fit(X_train_scaled, y_train)


# ===========================================
# 5. Model Evaluation
# ===========================================
y_pred = rf_model.predict(X_test_scaled)

rmse = np.sqrt(mean_squared_error(y_test, y_pred))
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print("\n📈 Model Performance:")
print(f"RMSE: {rmse:.2f}")
print(f"MAE: {mae:.2f}")
print(f"R² Score: {r2:.3f}")

# ===========================================
# 6. Visualization
# ===========================================
plt.figure(figsize=(10, 5))
plt.plot(y_test.index, y_test, label="Actual Demand", linewidth=2)
plt.plot(y_test.index, y_pred, label="Predicted Demand", linestyle="--", linewidth=2)
plt.title("Actual vs Predicted Demand (Units)")
plt.xlabel("Date")
plt.ylabel("Units Sold")
plt.legend()
plt.tight_layout()
plt.show()


# ===========================================
# 7. Future Forecasting
# ===========================================
future_steps = 30  # You can change the number of days to forecast

last_known = X.iloc[-1:].copy()
future_preds = []

for i in range(future_steps):
    scaled_input = scaler.transform(last_known)
    next_pred = rf_model.predict(scaled_input)[0]
    future_preds.append(next_pred)

    # Update lag features
    last_known["lag_1"] = next_pred
    last_known["lag_7"] = last_known["lag_1"]
    last_known["rolling_mean_7"] = np.mean(future_preds[-7:]) if len(future_preds) >= 7 else np.mean(future_preds)

future_dates = pd.date_range(start=data.index[-1] + pd.Timedelta(days=1), periods=future_steps)
forecast_df = pd.DataFrame({"Predicted_Demand": future_preds}, index=future_dates)

print("\n🔮 Future Demand Forecast (Units):")
print(forecast_df.head())

# Plot forecast
plt.figure(figsize=(10, 5))
plt.plot(forecast_df.index, forecast_df["Predicted_Demand"], marker="o", label="Forecasted Demand")
plt.title("30-Day Demand Forecast (Units)")
plt.xlabel("Date")
plt.ylabel("Predicted Demand (Units)")
plt.legend()
plt.tight_layout()
plt.show()


# ===========================================
# 8. Save Model and Scaler
# ===========================================
joblib.dump(rf_model, "demand_forecast_model.pkl")
joblib.dump(scaler, "scaler.pkl")

print("✅ Model and Scaler saved successfully as 'demand_forecast_model.pkl' and 'scaler.pkl'")
