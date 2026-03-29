package com.imagesystems.persistence;

import java.util.List;

public interface ProcessingHistoryRepositoryCustom {

    List<ProcessingHistoryEntity> findByUserIdOrderByCreatedAtDesc(String userId, int offset, int limit);

    List<ProcessingHistoryEntity> findByUserIdAndActionOrderByCreatedAtDesc(
            String userId, String action, int offset, int limit);
}
