import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

interface Organization {
    id: string;
    name: string;
    created_at: string;
}

interface OrgMember {
    id: string;
    organization_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
}

interface OrganizationContextType {
    currentOrg: Organization | null;
    membership: OrgMember | null;
    loading: boolean;
    organizationId: string | null;
    createOrganization: (name: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [membership, setMembership] = useState<OrgMember | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setCurrentOrg(null);
            setMembership(null);
            setLoading(false);
            return;
        }
        fetchOrganization();
    }, [user]);

    const fetchOrganization = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Step 1: Get membership rows for current user
            const { data: members, error: memError } = await supabase
                .from('organization_members')
                .select('*')
                .eq('user_id', user.id)
                .limit(1);

            if (memError) {
                console.error('Error fetching membership:', memError);
                setLoading(false);
                return;
            }

            if (members && members.length > 0) {
                const m = members[0];
                setMembership({
                    id: m.id,
                    organization_id: m.organization_id,
                    user_id: m.user_id,
                    role: m.role,
                });

                // Step 2: Get the org details separately
                const { data: orgData, error: orgError } = await supabase
                    .from('organizations')
                    .select('*')
                    .eq('id', m.organization_id)
                    .single();

                if (orgError) {
                    console.error('Error fetching org:', orgError);
                } else {
                    setCurrentOrg(orgData);
                }
            } else {
                setCurrentOrg(null);
                setMembership(null);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
        }

        setLoading(false);
    };

    const createOrganization = async (name: string) => {
        if (!user) return;

        // 1. Create org
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({ name })
            .select()
            .single();

        if (orgError || !org) {
            console.error('Error creating org:', orgError);
            alert('Error al crear organización: ' + (orgError?.message || 'Error desconocido'));
            return;
        }

        // 2. Add current user as owner
        const { error: memberError } = await supabase
            .from('organization_members')
            .insert({
                organization_id: org.id,
                user_id: user.id,
                role: 'owner',
            });

        if (memberError) {
            console.error('Error adding member:', memberError);
            alert('Error al agregar miembro: ' + memberError.message);
            return;
        }

        // 3. Refresh
        await fetchOrganization();
    };

    const value: OrganizationContextType = {
        currentOrg,
        membership,
        loading,
        organizationId: currentOrg?.id || null,
        createOrganization,
    };

    return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};

export const useOrganization = () => {
    const context = useContext(OrganizationContext);
    if (context === undefined) {
        throw new Error('useOrganization must be used within an OrganizationProvider');
    }
    return context;
};
