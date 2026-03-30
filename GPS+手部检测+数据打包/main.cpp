#include <Arduino.h>
#include <WiFi.h>
#include "gps_config.h"

bool wifiConnected = false;

void initWiFi();
void sendTestData(); 

void setup() 
{
  Serial.begin(115200);
  delay(1000);
  
  initWiFi();
}

void loop()
{
  if (wifiConnected) {
    sendTestData();
  }

  delay(3000);
}

// ------------------- WiFi 初始化 -------------------
void initWiFi() 
{
  Serial.print("🔌 连接 WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) 
  {
    delay(500);
    Serial.print(".");
  }
  wifiConnected = true;
  Serial.println("\n✅ WiFi 连接成功！");
  Serial.print("📡 本地IP: ");
  Serial.println(WiFi.localIP());
}

void sendTestData()
{
  String data = "{"
                "\"type\":\"test\","
                "\"content\":\"ESP32通信正常\","
                "\"ip\":\"" + WiFi.localIP().toString() + "\","
                "\"timestamp\":" + String(millis()) +
                "}";

  Serial.println("==================================");
  Serial.println("📤 统一格式数据：");
  Serial.println(data);
  Serial.println("==================================");
}
