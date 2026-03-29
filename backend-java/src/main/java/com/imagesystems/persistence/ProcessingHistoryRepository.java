package com.imagesystems.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessingHistoryRepository
        extends JpaRepository<ProcessingHistoryEntity, String>, ProcessingHistoryRepositoryCustom {}
