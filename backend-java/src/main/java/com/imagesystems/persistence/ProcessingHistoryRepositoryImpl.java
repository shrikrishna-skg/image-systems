package com.imagesystems.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class ProcessingHistoryRepositoryImpl implements ProcessingHistoryRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    @Override
    public List<ProcessingHistoryEntity> findByUserIdOrderByCreatedAtDesc(
            String userId, int offset, int limit) {
        return em.createQuery(
                        "SELECT h FROM ProcessingHistoryEntity h WHERE h.userId = :uid ORDER BY h.createdAt DESC",
                        ProcessingHistoryEntity.class)
                .setParameter("uid", userId)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }

    @Override
    public List<ProcessingHistoryEntity> findByUserIdAndActionOrderByCreatedAtDesc(
            String userId, String action, int offset, int limit) {
        return em.createQuery(
                        "SELECT h FROM ProcessingHistoryEntity h WHERE h.userId = :uid AND h.action = :act ORDER BY h.createdAt DESC",
                        ProcessingHistoryEntity.class)
                .setParameter("uid", userId)
                .setParameter("act", action)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }
}
