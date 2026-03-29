#pragma once

#include <Arduino.h>

namespace wifi_test {

struct WiFiTestConfig {
  const char* ssid;
  const char* password;
  const char* serverHost;
  uint16_t serverPort;
  const char* reportPath;
  const char* pingPath;
  const char* deviceName;
  unsigned long wifiTimeoutMs;
  unsigned long reconnectIntervalMs;
  unsigned long heartbeatIntervalMs;
  unsigned long statusPrintIntervalMs;
};

struct WiFiTestStats {
  bool wifiConnected;
  bool lastPostSucceeded;
  unsigned long bootMillis;
  unsigned long connectAttempts;
  unsigned long successfulPosts;
  unsigned long failedPosts;
  unsigned long lastPostAt;
  int lastHttpCode;
  long lastRssi;
};

const WiFiTestConfig& config();
const WiFiTestStats& stats();

void begin();
void tick();
void printHelp();
void printStatus();
void forceReconnect();
bool sendHeartbeatNow();
String buildHeartbeatPayload();
bool handleSerialCommand(char command);

}  // namespace wifi_test
