#include "gps_module.h"

GPSModule::GPSModule(int rxPin, int txPin) 
    : rxPin(rxPin), txPin(txPin), locationValid(false), lastUpdateTime(0) {
    gpsSerial = &Serial2;
}

void GPSModule::begin() {
    gpsSerial->begin(9600, SERIAL_8N1, rxPin, txPin);
}

bool GPSModule::update() {
    while (gpsSerial->available() > 0) {
        if (gps.encode(gpsSerial->read())) {
            if (gps.location.isValid()) {
                locationValid = true;
                lastUpdateTime = millis();
                return true;
            }
        }
    }
    
    if (millis() - lastUpdateTime > GPS_TIMEOUT) {
        locationValid = false;
    }
    
    return false;
}

double GPSModule::getLatitude() {
    if (locationValid && gps.location.isValid()) {
        return gps.location.lat();
    }
    return 0.0;
}

double GPSModule::getLongitude() {
    if (locationValid && gps.location.isValid()) {
        return gps.location.lng();
    }
    return 0.0;
}

float GPSModule::getAltitude() {
    if (locationValid && gps.altitude.isValid()) {
        return gps.altitude.meters();
    }
    return 0.0;
}

float GPSModule::getSpeed() {
    if (locationValid && gps.speed.isValid()) {
        return gps.speed.kmph();
    }
    return 0.0;
}

bool GPSModule::hasLocation() {
    return locationValid;
}

bool GPSModule::isDataValid() {
    return locationValid && gps.location.isValid() && 
           gps.location.age() < 5000;
}

String GPSModule::getNMEAData() {
    String nmeaData = "";
    while (gpsSerial->available() > 0) {
        char c = gpsSerial->read();
        nmeaData += c;
    }
    return nmeaData;
}