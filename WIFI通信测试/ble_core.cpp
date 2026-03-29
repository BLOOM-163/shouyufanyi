#include "ble_config.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClient.h>

namespace wifi_test {
namespace {

WiFiTestConfig g_config = {
    "YOUR_WIFI_SSID",
    "YOUR_WIFI_PASSWORD",
    "192.168.1.100",
    3000,
    "/api/report",
    "/ping",
    "esp32-wifi-test",
    15000UL,
    5000UL,
    3000UL,
    5000UL,
};

WiFiTestStats g_stats = {
    false,
    false,
    0UL,
    0UL,
    0UL,
    0UL,
    0UL,
    0,
    0,
};

unsigned long g_lastConnectAttemptAt = 0UL;
unsigned long g_lastStatusPrintAt = 0UL;
String g_lastResponseBody;
String g_lastError;

String jsonBool(bool value) { return value ? "true" : "false"; }

String currentIpString() {
  if (WiFi.status() != WL_CONNECTED) {
    return "0.0.0.0";
  }
  return WiFi.localIP().toString();
}

String buildUrl(const char* path) {
  return String("http://") + g_config.serverHost + ":" + String(g_config.serverPort) +
         String(path);
}

void connectToWiFi() {
  const unsigned long now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    g_stats.wifiConnected = true;
    g_stats.lastRssi = WiFi.RSSI();
    return;
  }

  if (now - g_lastConnectAttemptAt < g_config.reconnectIntervalMs &&
      g_stats.connectAttempts > 0) {
    return;
  }

  g_lastConnectAttemptAt = now;
  g_stats.connectAttempts++;
  g_stats.wifiConnected = false;

  Serial.println();
  Serial.println("[WiFiTest] Connecting to WiFi...");
  Serial.print("[WiFiTest] SSID: ");
  Serial.println(g_config.ssid);

  WiFi.disconnect(true, true);
  delay(200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(g_config.ssid, g_config.password);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startedAt < g_config.wifiTimeoutMs) {
    Serial.print('.');
    delay(500);
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    g_stats.wifiConnected = true;
    g_stats.lastRssi = WiFi.RSSI();
    g_lastError = "";
    Serial.print("[WiFiTest] Connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    g_stats.wifiConnected = false;
    g_lastError = "WiFi connect timeout";
    Serial.println("[WiFiTest] WiFi connection failed.");
  }
}

void maybePrintStatus() {
  const unsigned long now = millis();
  if (now - g_lastStatusPrintAt < g_config.statusPrintIntervalMs) {
    return;
  }

  g_lastStatusPrintAt = now;
  printStatus();
}

}  // namespace

const WiFiTestConfig& config() { return g_config; }

const WiFiTestStats& stats() { return g_stats; }

String buildHeartbeatPayload() {
  g_stats.wifiConnected = WiFi.status() == WL_CONNECTED;
  g_stats.lastRssi = g_stats.wifiConnected ? WiFi.RSSI() : 0;

  String payload = "{";
  payload += "\"device\":\"";
  payload += g_config.deviceName;
  payload += "\",";
  payload += "\"uptime_ms\":";
  payload += String(millis());
  payload += ",";
  payload += "\"wifi\":{";
  payload += "\"connected\":";
  payload += jsonBool(g_stats.wifiConnected);
  payload += ",";
  payload += "\"ssid\":\"";
  payload += g_config.ssid;
  payload += "\",";
  payload += "\"ip\":\"";
  payload += currentIpString();
  payload += "\",";
  payload += "\"rssi\":";
  payload += String(g_stats.lastRssi);
  payload += "},";
  payload += "\"stats\":{";
  payload += "\"connectAttempts\":";
  payload += String(g_stats.connectAttempts);
  payload += ",";
  payload += "\"successfulPosts\":";
  payload += String(g_stats.successfulPosts);
  payload += ",";
  payload += "\"failedPosts\":";
  payload += String(g_stats.failedPosts);
  payload += "}";
  payload += "}";
  return payload;
}

bool sendHeartbeatNow() {
  connectToWiFi();
  if (WiFi.status() != WL_CONNECTED) {
    g_stats.lastPostSucceeded = false;
    g_stats.failedPosts++;
    g_stats.lastHttpCode = -1;
    g_lastError = "WiFi not connected";
    return false;
  }

  HTTPClient http;
  WiFiClient client;
  const String url = buildUrl(g_config.reportPath);
  const String payload = buildHeartbeatPayload();

  http.setTimeout(5000);
  if (!http.begin(client, url)) {
    g_stats.lastPostSucceeded = false;
    g_stats.failedPosts++;
    g_stats.lastHttpCode = -2;
    g_lastError = "HTTP begin failed";
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Name", g_config.deviceName);

  const int statusCode = http.POST(payload);
  g_stats.lastPostAt = millis();
  g_stats.lastHttpCode = statusCode;

  if (statusCode > 0) {
    g_stats.lastPostSucceeded = statusCode >= 200 && statusCode < 300;
    g_lastResponseBody = http.getString();
    g_lastError = g_stats.lastPostSucceeded ? "" : "Unexpected HTTP status";
    if (g_stats.lastPostSucceeded) {
      g_stats.successfulPosts++;
    } else {
      g_stats.failedPosts++;
    }
  } else {
    g_stats.lastPostSucceeded = false;
    g_stats.failedPosts++;
    g_lastResponseBody = "";
    g_lastError = HTTPClient::errorToString(statusCode);
  }

  http.end();

  Serial.print("[WiFiTest] POST ");
  Serial.print(url);
  Serial.print(" -> ");
  Serial.println(statusCode);

  if (g_lastResponseBody.length() > 0) {
    Serial.print("[WiFiTest] Response: ");
    Serial.println(g_lastResponseBody);
  }

  if (g_lastError.length() > 0) {
    Serial.print("[WiFiTest] Error: ");
    Serial.println(g_lastError);
  }

  return g_stats.lastPostSucceeded;
}

void printHelp() {
  Serial.println("[WiFiTest] Available serial commands:");
  Serial.println("  h - show this help");
  Serial.println("  s - print current status");
  Serial.println("  p - send one heartbeat immediately");
  Serial.println("  r - force WiFi reconnect");
}

void printStatus() {
  g_stats.wifiConnected = WiFi.status() == WL_CONNECTED;
  g_stats.lastRssi = g_stats.wifiConnected ? WiFi.RSSI() : 0;

  Serial.println();
  Serial.println("[WiFiTest] ===== Status =====");
  Serial.print("[WiFiTest] Device: ");
  Serial.println(g_config.deviceName);
  Serial.print("[WiFiTest] WiFi connected: ");
  Serial.println(g_stats.wifiConnected ? "YES" : "NO");
  Serial.print("[WiFiTest] Local IP: ");
  Serial.println(currentIpString());
  Serial.print("[WiFiTest] RSSI: ");
  Serial.println(g_stats.lastRssi);
  Serial.print("[WiFiTest] Connect attempts: ");
  Serial.println(g_stats.connectAttempts);
  Serial.print("[WiFiTest] Successful POSTs: ");
  Serial.println(g_stats.successfulPosts);
  Serial.print("[WiFiTest] Failed POSTs: ");
  Serial.println(g_stats.failedPosts);
  Serial.print("[WiFiTest] Last HTTP code: ");
  Serial.println(g_stats.lastHttpCode);
  Serial.print("[WiFiTest] Last response: ");
  if (g_lastResponseBody.length() == 0) {
    Serial.println("(empty)");
  } else {
    Serial.println(g_lastResponseBody);
  }
  Serial.print("[WiFiTest] Last error: ");
  if (g_lastError.length() == 0) {
    Serial.println("(none)");
  } else {
    Serial.println(g_lastError);
  }
  Serial.println("[WiFiTest] ===================");
}

void forceReconnect() {
  Serial.println("[WiFiTest] Forcing WiFi reconnect...");
  WiFi.disconnect(true, true);
  delay(200);
  g_stats.wifiConnected = false;
  connectToWiFi();
}

bool handleSerialCommand(char command) {
  switch (command) {
    case 'h':
    case 'H':
      printHelp();
      return true;
    case 's':
    case 'S':
      printStatus();
      return true;
    case 'p':
    case 'P':
      return sendHeartbeatNow();
    case 'r':
    case 'R':
      forceReconnect();
      return true;
    case '\r':
    case '\n':
      return false;
    default:
      Serial.print("[WiFiTest] Unknown command: ");
      Serial.println(command);
      printHelp();
      return false;
  }
}

void begin() {
  g_stats.bootMillis = millis();
  WiFi.mode(WIFI_STA);

  Serial.println();
  Serial.println("[WiFiTest] ESP32 WiFi communication test starting...");
  Serial.print("[WiFiTest] Target server: ");
  Serial.print(g_config.serverHost);
  Serial.print(':');
  Serial.println(g_config.serverPort);
  printHelp();

  connectToWiFi();
  sendHeartbeatNow();
}

void tick() {
  connectToWiFi();

  while (Serial.available() > 0) {
    const char command = static_cast<char>(Serial.read());
    handleSerialCommand(command);
  }

  const bool shouldSendHeartbeat =
      millis() - g_stats.lastPostAt >= g_config.heartbeatIntervalMs;
  if (shouldSendHeartbeat) {
    sendHeartbeatNow();
  }

  maybePrintStatus();
}

}  // namespace wifi_test
