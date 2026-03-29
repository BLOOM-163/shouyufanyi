#include <Arduino.h>

#include "ble_config.h"

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println(" ESP32 WiFi Communication Test");
  Serial.println(" File name keeps ble_test.cpp only");
  Serial.println(" because the project already uses it.");
  Serial.println("========================================");

  wifi_test::begin();
}

void loop() {
  wifi_test::tick();
  delay(20);
}
