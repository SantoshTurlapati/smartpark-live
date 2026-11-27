package com.smartpark.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class DashboardDataDtos {
  public record SlotData(String id, String code, String status) {}

  public record LocationData(
    String id,
    String name,
    String address,
    String city,
    String ownerId,
    String ownerEmail,
    Double latitude,
    Double longitude,
    BigDecimal pricePerHour,
    String status,
    Instant updatedAt,
    int totalSlots,
    long availableSlots,
    List<SlotData> slots) {}

  public record UserData(
    String id,
    String name,
    String email,
    String role,
    String accountStatus,
    String ownerVerification,
    Instant createdAt) {}

  public record PaymentData(
    String id,
    String bookingId,
    BigDecimal amount,
    String status,
    String provider,
    Instant createdAt) {}

  public record BookingData(
    String id,
    String customerId,
    String customerEmail,
    String locationId,
    String locationName,
    String slotId,
    String vehicleNumber,
    Instant startTime,
    Instant endTime,
    String status,
    BigDecimal amount,
    Instant createdAt,
    String paymentStatus) {}

  public record DashboardData(
    List<LocationData> locations,
    List<BookingData> bookings,
    List<PaymentData> payments,
    List<UserData> users) {}
}
