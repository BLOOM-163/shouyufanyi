#ifndef GPS_MODULE_H
#define GPS_MODULE_H

#include <Arduino.h>
#include <TinyGPS++.h>

class GPSModule {
public:
    GPSModule(int rxPin, int txPin);
    void begin();
    bool update();
    double getLatitude();
    double getLongitude();
    float getAltitude();
    float getSpeed();
    bool hasLocation();
    bool isDataValid();
    String getNMEAData();
    
private:
    TinyGPSPlus gps;
    HardwareSerial* gpsSerial;
    int rxPin;
    int txPin;
    bool locationValid;
    unsigned long lastUpdateTime;
    const unsigned long GPS_TIMEOUT = 2000;
};

#endif