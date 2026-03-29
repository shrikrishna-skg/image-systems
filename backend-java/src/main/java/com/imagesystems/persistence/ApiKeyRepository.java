package com.imagesystems.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApiKeyRepository extends JpaRepository<ApiKeyEntity, String> {

    List<ApiKeyEntity> findByUserId(String userId);

    Optional<ApiKeyEntity> findByUserIdAndProvider(String userId, String provider);

    Optional<ApiKeyEntity> findByIdAndUserId(String id, String userId);
}
