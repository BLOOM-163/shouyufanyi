#include <WiFi.h>
#include <WebServer.h>
#include "gps_module.h"
#include "data_packet.h"

#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
#define WIFI_SSID "YourWiFiSSID"
#define WIFI_PASSWORD "YourWiFiPassword"
#define SERVER_PORT 80

WebServer server(SERVER_PORT);
GPSModule gps(GPS_RX_PIN, GPS_TX_PIN);
DataPacket dataPacket;

bool wifiConnected = false;
unsigned long lastDataSend = 0;
const unsigned long DATA_SEND_INTERVAL = 1000;

void handleRoot() {
    String html = "<html><body><h1>手语翻译系统 ESP32</h1>";
    html += "<p>系统运行中</p>";
    html += "<p>GPS状态: " + String(gps.hasLocation() ? "已定位" : "未定位") + "</p>";
    html += "</body></html>";
    server.send(200, "text/html", html);
}

void handleGetData() {
    String json = dataPacket.toJSON();
    server.send(200, "application/json", json);
}

void handlePostData() {
    if (server.hasArg("plain")) {
        String jsonStr = server.arg("plain");
        if (dataPacket.fromJSON(jsonStr)) {
            server.send(200, "application/json", "{\"status\":\"success\"}");
        } else {
            server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid data\"}");
        }
    } else {
        server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"No data received\"}");
    }
}

void handleStatus() {
    StaticJsonDocument<256> doc;
    doc["wifi_connected"] = wifiConnected;
    doc["gps_valid"] = gps.hasLocation();
    doc["gps_lat"] = gps.getLatitude();
    doc["gps_lon"] = gps.getLongitude();
    doc["uptime"] = millis() / 1000;
    
    String output;
    serializeJson(doc, output);
    server.send(200, "application/json", output);
}

void setupWiFi() {
    Serial.println("正在连接WiFi...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.println("\nWiFi连接成功!");
        Serial.print("IP地址: ");
        Serial.println(WiFi.localIP());
    } else {
        wifiConnected = false;
        Serial.println("\nWiFi连接失败!");
    }
}

void setupServer() {
    server.on("/", handleRoot);
    server.on("/api/data", HTTP_GET, handleGetData);
    server.on("/api/data", HTTP_POST, handlePostData);
    server.on("/api/status", HTTP_GET, handleStatus);
    
    server.enableCORS(true);
    server.begin();
    Serial.println("HTTP服务器已启动");
}

void updateGPSData() {
    if (gps.update()) {
        dataPacket.setGPSData(
            gps.getLatitude(),
            gps.getLongitude(),
            gps.getAltitude(),
            gps.getSpeed(),
            gps.isDataValid()
        );
        Serial.println("GPS数据已更新");
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("手语翻译系统 ESP32 启动中...");
    
    gps.begin();
    Serial.println("GPS模块已初始化");
    
    setupWiFi();
    setupServer();
    
    Serial.println("系统初始化完成!");
}

void loop() {
    server.handleClient();
    
    updateGPSData();
    
    if (millis() - lastDataSend >= DATA_SEND_INTERVAL) {
        lastDataSend = millis();
        
        if (WiFi.status() != WL_CONNECTED) {
            wifiConnected = false;
            Serial.println("WiFi连接断开，尝试重连...");
            setupWiFi();
        }
    }
    
    delay(10);
}