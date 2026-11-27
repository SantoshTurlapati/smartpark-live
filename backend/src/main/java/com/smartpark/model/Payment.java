package com.smartpark.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name="payments")
public class Payment {
  @Id @GeneratedValue(strategy=GenerationType.UUID)
  private String id;
  @Column(nullable=false) private String bookingId;
  @Column(nullable=false) private BigDecimal amount;
  @Column(nullable=false) private String status = "PENDING";
  @Column(nullable=false) private String provider = "DEMO";
  @Column(nullable=false) private Instant createdAt = Instant.now();

  public String getId(){return id;} public void setId(String id){this.id=id;}
  public String getBookingId(){return bookingId;} public void setBookingId(String bookingId){this.bookingId=bookingId;}
  public BigDecimal getAmount(){return amount;} public void setAmount(BigDecimal amount){this.amount=amount;}
  public String getStatus(){return status;} public void setStatus(String status){this.status=status;}
  public String getProvider(){return provider;} public void setProvider(String provider){this.provider=provider;}
  public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant createdAt){this.createdAt=createdAt;}
}
