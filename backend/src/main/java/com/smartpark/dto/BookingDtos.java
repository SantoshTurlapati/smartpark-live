package com.smartpark.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public class BookingDtos {
  public record CreateBookingRequest(
    @NotBlank String locationId,
    @NotBlank String slotId,
    @NotBlank @org.hibernate.validator.constraints.Length(max=20) String vehicleNumber,
    @NotNull @Future Instant startTime,
    @NotNull Instant endTime) {}
  public record PaymentRequest(@NotBlank String method) {}
}
