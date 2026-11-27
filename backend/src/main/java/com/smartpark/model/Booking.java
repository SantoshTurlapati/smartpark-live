package com.smartpark.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name="bookings")
public class Booking {
  @Id @GeneratedValue(strategy=GenerationType.UUID)
  private String id;
  @Column(nullable=false) private String customerId;
  @Column(nullable=false) private String locationId;
  @Column(nullable=false) private String slotId;
  @Column(nullable=false) private String vehicleNumber;
  @Column(nullable=false) private Instant startTime;
  @Column(nullable=false) private Instant endTime;
  @Column(nullable=false) private String status = "Reserved";
  @Column(nullable=false) private BigDecimal amount = BigDecimal.ZERO;
  @Column(nullable=false) private Instant createdAt = Instant.now();

  public String getId(){return id;} public void setId(String id){this.id=id;}
  public String getCustomerId(){return customerId;} public void setCustomerId(String customerId){this.customerId=customerId;}
  public String getLocationId(){return locationId;} public void setLocationId(String locationId){this.locationId=locationId;}
  public String getSlotId(){return slotId;} public void setSlotId(String slotId){this.slotId=slotId;}
  public String getVehicleNumber(){return vehicleNumber;} public void setVehicleNumber(String vehicleNumber){this.vehicleNumber=vehicleNumber;}
  public Instant getStartTime(){return startTime;} public void setStartTime(Instant startTime){this.startTime=startTime;}
  public Instant getEndTime(){return endTime;} public void setEndTime(Instant endTime){this.endTime=endTime;}
  public String getStatus(){return status;} public void setStatus(String status){this.status=status;}
  public BigDecimal getAmount(){return amount;} public void setAmount(BigDecimal amount){this.amount=amount;}
  public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant createdAt){this.createdAt=createdAt;}
}
